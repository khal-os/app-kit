import asyncio
import signal
import sys
import os
from nats.aio.client import Client as NATS


async def main():
    nc = NATS()
    nats_url = os.environ.get("NATS_URL", "nats://localhost:4222")
    await nc.connect(nats_url)
    print("[hello-voice] HELLO voice engine ready")

    if "--test-nats" in sys.argv:
        await publish_test_events(nc)
        await nc.close()
        return

    stop = asyncio.Event()

    def shutdown():
        print("[hello-voice] shutting down...")
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown)

    await stop.wait()
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
