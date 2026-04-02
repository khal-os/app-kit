"""Pipeline builder — assembles Pipecat pipeline for voice calls.

Pipeline structure:
  transport.input() -> gemini_live -> nats_relay -> transport.output()

GeminiLive sits in the middle as the speech-to-speech engine.
NatsRelay captures transcription/text events and injects NATS commands.
Transport handles audio I/O with format conversion (mu-law <-> PCM).
"""
import asyncio

from agents.registry import AgentConfig
from processors.nats_relay import NatsRelay
from transports.gemini import create_gemini_live
from transports.twilio import create_twilio_transport

MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds


async def build_and_run_pipeline(
    websocket,
    stream_sid: str,
    nc,
    agent: AgentConfig,
    call_id: str,
):
    """Build and run a complete voice pipeline for one call.

    Blocks until the pipeline finishes (call ends, WS disconnects, or error).
    On Gemini disconnect, retries up to MAX_RETRIES with exponential backoff.
    """
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineTask, PipelineParams

    transport = create_twilio_transport(websocket, stream_sid)
    relay = NatsRelay(nc=nc, agent_id=agent.slug)

    await relay.start()
    try:
        for attempt in range(MAX_RETRIES + 1):
            try:
                gemini = create_gemini_live(agent)

                pipeline = Pipeline([
                    transport.input(),
                    gemini,
                    relay,
                    transport.output(),
                ])

                task = PipelineTask(
                    pipeline,
                    params=PipelineParams(allow_interruptions=True),
                )

                runner = PipelineRunner(handle_sigint=False)
                await runner.run(task)
                break  # Clean exit — call ended normally

            except (ConnectionError, OSError) as e:
                if attempt < MAX_RETRIES:
                    wait = BACKOFF_BASE ** (attempt + 1)
                    print(f"[hello-voice] pipeline error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                    print(f"[hello-voice] retrying in {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    print(f"[hello-voice] pipeline failed after {MAX_RETRIES} retries: {e}")
                    raise
    finally:
        await relay.stop()
