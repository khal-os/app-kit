"""NATS relay processor — bridges Pipecat frames to/from NATS subjects."""
import asyncio
import json
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    TextFrame,
    EndFrame,
)

from ..subjects import event_subject, cmd_subject, USER_SPEECH, AGENT_SPOKE, TOOL_CALL, INJECT_CONTEXT, SPEAK, END_CALL, TRANSFER, SEND_DTMF
from ..schemas import UserSpeechEvent, AgentSpokeEvent, InjectContextCmd, to_json


class NatsRelay(FrameProcessor):
    """Thin bidirectional relay between Pipecat pipeline and NATS."""

    def __init__(self, nc, agent_id: str, **kwargs):
        super().__init__(**kwargs)
        self._nc = nc
        self._agent_id = agent_id
        self._cmd_task = None

    async def start(self):
        """Subscribe to NATS command subjects."""
        self._cmd_task = asyncio.create_task(self._subscribe_commands())

    async def stop(self):
        """Unsubscribe from commands."""
        if self._cmd_task:
            self._cmd_task.cancel()

    async def _subscribe_commands(self):
        sub = await self._nc.subscribe(cmd_subject(self._agent_id, ">"))
        async for msg in sub.messages:
            subject = msg.subject
            data = json.loads(msg.data) if msg.data else {}

            if subject.endswith(f".{INJECT_CONTEXT}"):
                from pipecat.frames.frames import LLMMessagesAppendFrame
                messages = data.get("messages", [])
                await self.push_frame(LLMMessagesAppendFrame(messages=messages))
            elif subject.endswith(f".{SPEAK}"):
                await self.push_frame(TextFrame(text=data.get("text", "")))
            elif subject.endswith(f".{END_CALL}"):
                await self.push_frame(EndFrame())
            elif subject.endswith(f".{TRANSFER}"):
                await self._nc.publish(
                    event_subject(self._agent_id, "transfer_requested"),
                    json.dumps(data).encode()
                )
            elif subject.endswith(f".{SEND_DTMF}"):
                await self._nc.publish(
                    event_subject(self._agent_id, "dtmf_requested"),
                    json.dumps(data).encode()
                )

    async def process_frame(self, frame: Frame, direction):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame):
            event = UserSpeechEvent(text=frame.text, is_partial=False)
            await self._nc.publish(
                event_subject(self._agent_id, USER_SPEECH),
                to_json(event)
            )
        elif isinstance(frame, TextFrame):
            event = AgentSpokeEvent(text=frame.text, is_partial=False)
            await self._nc.publish(
                event_subject(self._agent_id, AGENT_SPOKE),
                to_json(event)
            )

        await self.push_frame(frame, direction)
