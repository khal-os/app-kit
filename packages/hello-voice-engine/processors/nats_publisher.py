"""One-way NATS event publisher for simpler use cases."""
import json
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.frames.frames import Frame, TranscriptionFrame, TextFrame

from ..subjects import event_subject, USER_SPEECH, AGENT_SPOKE
from ..schemas import UserSpeechEvent, AgentSpokeEvent, to_json


class NatsPublisher(FrameProcessor):
    """Publish-only processor — no command subscription."""

    def __init__(self, nc, agent_id: str, **kwargs):
        super().__init__(**kwargs)
        self._nc = nc
        self._agent_id = agent_id

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
