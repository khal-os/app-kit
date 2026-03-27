"""Voice pipeline builder — assembles transport, LLM, and processors."""
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineParams, PipelineTask


def build_pipeline(transport, llm, nats_relay, vad=None) -> Pipeline:
    """Build a Pipecat pipeline with transport, LLM, and NATS relay.

    Pipeline flow:
        Transport.input() → nats_relay → LLM → nats_relay → Transport.output()
    """
    processors = [transport.input()]

    if vad:
        processors.append(vad)

    processors.extend([nats_relay, llm, nats_relay, transport.output()])

    return Pipeline(processors)


def create_pipeline_task(pipeline: Pipeline, allow_interruptions: bool = True) -> PipelineTask:
    """Create a pipeline task with standard parameters."""
    return PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=allow_interruptions),
    )
