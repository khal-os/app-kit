import asyncio
import json
import signal
import sys
import os
import time
from dataclasses import asdict

import uvicorn
from fastapi import FastAPI, WebSocket
from nats.aio.client import Client as NATS

from agents.registry import AgentRegistry, AgentConfig
from agents.lifecycle import AgentLifecycle
from call_manager import CallManager
from subjects import event_subject, CALL_STATE
from schemas import CallStateEvent, to_json

# FastAPI app for Twilio WebSocket callbacks
app = FastAPI(title="HELLO Voice Engine")


@app.websocket("/twilio/ws/{call_id}")
async def twilio_ws(websocket: WebSocket, call_id: str):
    """WebSocket endpoint for Twilio Media Streams.

    Twilio connects here after an outbound call is answered.
    The handler reads the stream start event, creates the Pipecat
    pipeline, and runs it until the call ends.
    """
    await websocket.accept()

    call_mgr: CallManager = app.state.call_manager
    nc: NATS = app.state.nc
    registry: AgentRegistry = app.state.registry

    pending = call_mgr.get_pending(call_id)
    if not pending:
        print(f"[hello-voice] unknown call_id: {call_id}")
        await websocket.close()
        return

    agent = registry.get(pending.agent_slug)
    if not agent:
        print(f"[hello-voice] agent not found for call {call_id}")
        await websocket.close()
        return

    # Read Twilio protocol messages until we get the "start" event with streamSid
    stream_sid = ""
    try:
        while True:
            data = await asyncio.wait_for(websocket.receive_json(), timeout=10)
            if data.get("event") == "start":
                stream_sid = data.get("start", {}).get("streamSid", "")
                break
    except (asyncio.TimeoutError, Exception) as e:
        print(f"[hello-voice] failed to receive Twilio start event: {e}")
        await websocket.close()
        return

    print(f"[hello-voice] Twilio stream connected: call={call_id} stream={stream_sid} agent={agent.slug}")

    await nc.publish(
        event_subject(agent.slug, CALL_STATE),
        to_json(CallStateEvent(state="connected")),
    )

    # Run the voice pipeline as an async task
    from transports.pipeline import build_and_run_pipeline

    async def run_pipeline():
        try:
            await build_and_run_pipeline(websocket, stream_sid, nc, agent, call_id)
        except Exception as e:
            print(f"[hello-voice] pipeline error: call={call_id} error={e}")
        finally:
            await call_mgr.hangup(call_id=call_id)

    task = asyncio.create_task(run_pipeline())
    call_mgr.activate_call(call_id, task)
    await task


async def main():
    from dotenv import load_dotenv
    load_dotenv()

    nc = NATS()
    nats_url = os.environ.get("NATS_URL", "nats://localhost:4222")
    await nc.connect(nats_url, connect_timeout=10)
    print("[hello-voice] HELLO voice engine ready")

    # Validate environment
    missing = []
    for var in ["GEMINI_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "HELLO_WS_PUBLIC_URL"]:
        if not os.environ.get(var):
            missing.append(var)
    if missing:
        print(f"[hello-voice] WARNING: Missing env vars: {', '.join(missing)}")
        print("[hello-voice] Voice calls will fail until these are set. See .env.example.")

    if "--test-nats" in sys.argv:
        await publish_test_events(nc)
        await nc.close()
        return

    # Initialize core components
    registry = AgentRegistry(nc)
    await registry.load()
    lifecycle = AgentLifecycle(registry)
    call_mgr = CallManager(nc, registry, lifecycle)

    # Make components available to FastAPI routes
    app.state.nc = nc
    app.state.registry = registry
    app.state.lifecycle = lifecycle
    app.state.call_manager = call_mgr

    stop = asyncio.Event()

    def shutdown():
        print("[hello-voice] shutting down...")
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown)

    # --- Agent management handlers ---
    async def handle_agent_create(msg):
        data = json.loads(msg.data)
        agent = AgentConfig(
            slug=data.get("slug", data.get("name", "").lower().replace(" ", "-")),
            name=data.get("name", ""),
            voice_id=data.get("voice", "Kore"),
            language=data.get("lang", "pt-BR"),
            system_prompt=data.get("prompt", ""),
            flow_json=data.get("flow"),
            transport=data.get("transport", "twilio"),
        )
        await registry.save(agent)
        await msg.respond(json.dumps({"ok": True, "agent": asdict(agent)}).encode())

    async def handle_agent_list(msg):
        agents = [asdict(a) for a in registry.list_all()]
        await msg.respond(json.dumps({"agents": agents}).encode())

    async def handle_agent_start(msg):
        data = json.loads(msg.data)
        ok, reason = await lifecycle.start(data["slug"])
        await msg.respond(json.dumps({"ok": ok, "message": reason}).encode())

    async def handle_agent_stop(msg):
        data = json.loads(msg.data)
        ok, reason = await lifecycle.stop(data["slug"])
        await msg.respond(json.dumps({"ok": ok, "message": reason}).encode())

    async def handle_agent_delete(msg):
        data = json.loads(msg.data)
        slug = data["slug"]
        if lifecycle.is_running(slug):
            await lifecycle.stop(slug)
        ok = await registry.delete(slug)
        await msg.respond(json.dumps({"ok": ok}).encode())

    async def handle_agent_config(msg):
        data = json.loads(msg.data)
        agent = registry.get(data["slug"])
        if agent:
            await msg.respond(json.dumps({"ok": True, "agent": asdict(agent)}).encode())
        else:
            await msg.respond(json.dumps({"ok": False, "error": "not found"}).encode())

    # --- Call management handlers ---
    async def handle_call_start(msg):
        data = json.loads(msg.data)
        result = await call_mgr.start_call(
            agent_slug=data.get("agent_slug", data.get("agent", "")),
            phone_number=data.get("phone_number", data.get("number", "")),
            dry_run=data.get("dry_run", False),
        )
        await msg.respond(json.dumps(result).encode())

    async def handle_call_hangup(msg):
        data = json.loads(msg.data)
        result = await call_mgr.hangup(
            call_id=data.get("call_id"),
            agent_slug=data.get("agent_slug", data.get("agent")),
        )
        await msg.respond(json.dumps(result).encode())

    async def handle_call_dtmf(msg):
        data = json.loads(msg.data)
        result = await call_mgr.send_dtmf(
            digits=data.get("digits", ""),
            call_id=data.get("call_id"),
            agent_slug=data.get("agent_slug", data.get("agent")),
        )
        await msg.respond(json.dumps(result).encode())

    async def handle_call_transfer(msg):
        data = json.loads(msg.data)
        result = await call_mgr.transfer(
            target_number=data.get("phone_number", data.get("number", "")),
            call_id=data.get("call_id"),
            agent_slug=data.get("agent_slug", data.get("agent")),
        )
        await msg.respond(json.dumps(result).encode())

    async def handle_call_metrics(msg):
        calls = call_mgr.list_active()
        await msg.respond(json.dumps({"calls": calls}).encode())

    # Subscribe to all NATS handlers
    await nc.subscribe("hello.agent.create", cb=handle_agent_create)
    await nc.subscribe("hello.agent.list", cb=handle_agent_list)
    await nc.subscribe("hello.agent.start", cb=handle_agent_start)
    await nc.subscribe("hello.agent.stop", cb=handle_agent_stop)
    await nc.subscribe("hello.agent.delete", cb=handle_agent_delete)
    await nc.subscribe("hello.agent.config", cb=handle_agent_config)
    await nc.subscribe("hello.call.start", cb=handle_call_start)
    await nc.subscribe("hello.call.hangup", cb=handle_call_hangup)
    await nc.subscribe("hello.call.dtmf", cb=handle_call_dtmf)
    await nc.subscribe("hello.call.transfer", cb=handle_call_transfer)
    await nc.subscribe("hello.call.metrics", cb=handle_call_metrics)

    # Health check — publish to khal._internal.system.health every 30s
    async def publish_health():
        while not stop.is_set():
            health = {
                "service": "hello-voice",
                "status": "healthy",
                "agents_registered": len(registry.list_all()),
                "agents_running": lifecycle.running_count,
                "active_calls": len(call_mgr.list_active()),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            await nc.publish("khal._internal.system.health", json.dumps(health).encode())
            await asyncio.sleep(30)

    asyncio.create_task(publish_health())

    # Duration limit checker (runs every 30s)
    async def check_limits():
        while not stop.is_set():
            expired = lifecycle.check_duration_limits()
            for slug in expired:
                print(f"[hello-voice] agent '{slug}' exceeded max duration — auto-stopping")
                await lifecycle.stop(slug)
            await asyncio.sleep(30)

    asyncio.create_task(check_limits())

    # Stale session cleanup — terminate calls inactive for 10 minutes
    async def cleanup_stale():
        while not stop.is_set():
            await call_mgr.cleanup_stale(timeout_sec=600)
            await asyncio.sleep(60)

    asyncio.create_task(cleanup_stale())

    # Start FastAPI server for Twilio WebSocket callbacks
    port = int(os.environ.get("HELLO_VOICE_PORT", "7860"))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())
    print(f"[hello-voice] Twilio WS server listening on port {port}")

    await stop.wait()

    # Graceful shutdown
    server.should_exit = True
    await server_task
    await lifecycle.stop_all()
    await nc.drain()
    print("[hello-voice] shutdown complete")


async def publish_test_events(nc):
    import json

    events = [
        ("hello.test-agent.event.user_speech", {"text": "Olá, tudo bem?", "is_partial": False, "timestamp": "2026-03-26T12:00:00Z"}),
        ("hello.test-agent.event.agent_spoke", {"text": "Olá! Como posso ajudar?", "is_partial": False, "timestamp": "2026-03-26T12:00:01Z"}),
        ("hello.test-agent.event.tool_call", {"name": "check_cpf", "args": {"cpf": "123.456.789-00"}, "call_id": "call-1"}),
    ]
    for subject, data in events:
        await nc.publish(subject, json.dumps(data).encode())
        print(f"[hello-voice] test event: {subject}")
    await nc.flush()


if __name__ == "__main__":
    asyncio.run(main())
