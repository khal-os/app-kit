"""WebRTC transport for browser-based voice connections."""
import os
from pipecat.transports.services.small_webrtc import SmallWebRTCTransport, SmallWebRTCParams


def create_webrtc_transport(host: str = "0.0.0.0", port: int = 7860) -> SmallWebRTCTransport:
    """Create a WebRTC transport for browser clients.

    Browser connects via WebRTC signaling at /api/offer endpoint.
    Audio flows bidirectionally: browser mic → Gemini → browser speaker.
    """
    return SmallWebRTCTransport(
        params=SmallWebRTCParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            host=host,
            port=port,
        )
    )
