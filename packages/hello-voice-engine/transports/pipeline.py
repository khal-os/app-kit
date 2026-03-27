"""Pipeline builder — assembles Pipecat pipeline for voice calls.

Pipeline structure:
  transport.input() -> gemini_live -> nats_relay -> transport.output()

GeminiLive sits in the middle as the speech-to-speech engine.
NatsRelay captures transcription/text events and injects NATS commands.
Transport handles audio I/O with format conversion (mu-law <-> PCM).
"""
from agents.registry import AgentConfig
from processors.nats_relay import NatsRelay
from transports.gemini import create_gemini_live
from transports.twilio import create_twilio_transport


async def build_and_run_pipeline(
    websocket,
    stream_sid: str,
    nc,
    agent: AgentConfig,
    call_id: str,
):
    """Build and run a complete voice pipeline for one call.

    Blocks until the pipeline finishes (call ends, WS disconnects, or error).
    """
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineTask, PipelineParams

    transport = create_twilio_transport(websocket, stream_sid)
    gemini = create_gemini_live(agent)
    relay = NatsRelay(nc=nc, agent_id=agent.slug)

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

    await relay.start()
    try:
        runner = PipelineRunner(handle_sigint=False)
        await runner.run(task)
    finally:
        await relay.stop()
