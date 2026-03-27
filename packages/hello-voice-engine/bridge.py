import asyncio
import json
import signal
import sys
import os
from dataclasses import asdict
from nats.aio.client import Client as NATS
from agents.registry import AgentRegistry, AgentConfig
from agents.lifecycle import AgentLifecycle


async def main():
    nc = NATS()
    nats_url = os.environ.get("NATS_URL", "nats://localhost:4222")
    await nc.connect(nats_url)
    print("[hello-voice] HELLO voice engine ready")

    if "--test-nats" in sys.argv:
        await publish_test_events(nc)
        await nc.close()
        return

    # Initialize registry and lifecycle
    registry = AgentRegistry(nc)
    await registry.load()
    lifecycle = AgentLifecycle(registry)

    stop = asyncio.Event()

    def shutdown():
        print("[hello-voice] shutting down...")
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown)

    # NATS handlers for agent management
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

    await nc.subscribe("hello.agent.create", cb=handle_agent_create)
    await nc.subscribe("hello.agent.list", cb=handle_agent_list)
    await nc.subscribe("hello.agent.start", cb=handle_agent_start)
    await nc.subscribe("hello.agent.stop", cb=handle_agent_stop)
    await nc.subscribe("hello.agent.delete", cb=handle_agent_delete)
    await nc.subscribe("hello.agent.config", cb=handle_agent_config)

    # Duration limit checker (runs every 30s)
    async def check_limits():
        while not stop.is_set():
            expired = lifecycle.check_duration_limits()
            for slug in expired:
                print(f"[hello-voice] agent '{slug}' exceeded max duration — auto-stopping")
                await lifecycle.stop(slug)
            await asyncio.sleep(30)

    asyncio.create_task(check_limits())

    await stop.wait()
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
