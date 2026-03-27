"""Active call management — tracks calls, handles start/hangup/DTMF/transfer."""
import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from agents.registry import AgentRegistry
from agents.lifecycle import AgentLifecycle
from transports.twilio import TwilioConfig, TwilioCallManager
from transports.gemini import validate_config as validate_gemini
from subjects import event_subject, CALL_STATE
from schemas import CallStateEvent, to_json


@dataclass
class ActiveCall:
    """Tracks state for a single voice call."""
    call_id: str
    agent_slug: str
    phone_number: str
    call_sid: str = ""
    started_at: float = 0.0
    pipeline_task: Optional[asyncio.Task] = field(default=None, repr=False)


class CallManager:
    """Manages the lifecycle of active voice calls."""

    def __init__(self, nc, registry: AgentRegistry, lifecycle: AgentLifecycle):
        self._nc = nc
        self._registry = registry
        self._lifecycle = lifecycle
        self._twilio_config = TwilioConfig.from_env()
        self._twilio = TwilioCallManager(self._twilio_config)
        self._active_calls: dict[str, ActiveCall] = {}
        self._pending_calls: dict[str, ActiveCall] = {}  # waiting for WS connect

    def validate_config(self) -> list[str]:
        """Validate all required configuration for placing calls."""
        errors = []
        errors.extend(self._twilio_config.validate())
        errors.extend(validate_gemini())
        return errors

    async def start_call(
        self,
        agent_slug: str,
        phone_number: str,
        dry_run: bool = False,
    ) -> dict:
        """Initiate an outbound call via Twilio."""
        agent = self._registry.get(agent_slug)
        if not agent:
            return {"ok": False, "error": f"Agent '{agent_slug}' not found"}

        if not self._lifecycle.is_running(agent_slug):
            return {"ok": False, "error": f"Agent '{agent_slug}' is not running. Start it first."}

        if not self._registry.check_budget(agent_slug):
            return {"ok": False, "error": f"Daily budget exceeded for '{agent_slug}'"}

        config_errors = self.validate_config()
        if config_errors:
            return {"ok": False, "error": f"Config errors: {', '.join(config_errors)}"}

        if dry_run:
            return {
                "ok": True,
                "message": "Config valid. Twilio + Gemini ready. Use without --dry-run to place call.",
                "dry_run": True,
            }

        call_id = str(uuid.uuid4())[:8]
        call = ActiveCall(
            call_id=call_id,
            agent_slug=agent_slug,
            phone_number=phone_number,
        )

        try:
            call_sid = self._twilio.make_outbound_call(phone_number, call_id)
            call.call_sid = call_sid
            call.started_at = time.time()
            self._pending_calls[call_id] = call

            await self._nc.publish(
                event_subject(agent_slug, CALL_STATE),
                to_json(CallStateEvent(state="ringing")),
            )

            return {
                "ok": True,
                "call_id": call_id,
                "call_sid": call_sid,
                "message": f"Calling {phone_number}...",
            }
        except Exception as e:
            return {"ok": False, "error": f"Twilio error: {e}"}

    def activate_call(self, call_id: str, pipeline_task: asyncio.Task):
        """Move a pending call to active once the Twilio WebSocket connects."""
        if call_id in self._pending_calls:
            call = self._pending_calls.pop(call_id)
            call.pipeline_task = pipeline_task
            self._active_calls[call_id] = call

    def get_pending(self, call_id: str) -> Optional[ActiveCall]:
        return self._pending_calls.get(call_id)

    def get_active(self, call_id: str) -> Optional[ActiveCall]:
        return self._active_calls.get(call_id)

    def get_active_for_agent(self, agent_slug: str) -> Optional[ActiveCall]:
        """Find active call by agent slug."""
        for call in self._active_calls.values():
            if call.agent_slug == agent_slug:
                return call
        return None

    async def hangup(
        self,
        call_id: str = None,
        agent_slug: str = None,
    ) -> dict:
        """Terminate a call by call_id or agent_slug."""
        call = self._resolve_call(call_id, agent_slug)
        if not call:
            # Check pending calls too
            if call_id and call_id in self._pending_calls:
                call = self._pending_calls.pop(call_id)
            else:
                return {"ok": False, "error": "No active call found"}

        try:
            if call.call_sid:
                self._twilio.hangup(call.call_sid)
        except Exception as e:
            print(f"[hello-voice] twilio hangup error: {e}")

        if call.pipeline_task and not call.pipeline_task.done():
            call.pipeline_task.cancel()

        self._active_calls.pop(call.call_id, None)
        self._pending_calls.pop(call.call_id, None)

        duration = time.time() - call.started_at if call.started_at else 0
        cost = (duration / 60) * 0.023  # Gemini rate per audio minute

        await self._nc.publish(
            event_subject(call.agent_slug, CALL_STATE),
            to_json(CallStateEvent(state="ended", duration=duration, cost=cost)),
        )
        self._registry.add_cost(call.agent_slug, cost)

        return {"ok": True, "duration": round(duration, 1), "cost": round(cost, 4)}

    async def send_dtmf(
        self,
        digits: str,
        call_id: str = None,
        agent_slug: str = None,
    ) -> dict:
        """Send DTMF tones to the remote party."""
        call = self._resolve_call(call_id, agent_slug)
        if not call:
            return {"ok": False, "error": "No active call found"}
        try:
            self._twilio.send_dtmf(call.call_sid, digits, call.call_id)
            return {"ok": True, "digits": digits}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def transfer(
        self,
        target_number: str,
        call_id: str = None,
        agent_slug: str = None,
    ) -> dict:
        """Transfer the call to another number."""
        call = self._resolve_call(call_id, agent_slug)
        if not call:
            return {"ok": False, "error": "No active call found"}
        try:
            self._twilio.transfer(call.call_sid, target_number)
            self._active_calls.pop(call.call_id, None)

            await self._nc.publish(
                event_subject(call.agent_slug, CALL_STATE),
                to_json(CallStateEvent(state="transferred")),
            )
            return {"ok": True, "transferred_to": target_number}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def list_active(self) -> list[dict]:
        """List all active calls with duration."""
        now = time.time()
        return [
            {
                "call_id": c.call_id,
                "agent_slug": c.agent_slug,
                "phone_number": c.phone_number,
                "duration": round(now - c.started_at, 1) if c.started_at else 0,
            }
            for c in self._active_calls.values()
        ]

    def _resolve_call(
        self,
        call_id: str = None,
        agent_slug: str = None,
    ) -> Optional[ActiveCall]:
        if call_id:
            return self._active_calls.get(call_id)
        if agent_slug:
            return self.get_active_for_agent(agent_slug)
        return None
