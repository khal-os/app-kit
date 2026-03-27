"""Twilio transport configuration and outbound call management.

Handles:
- FastAPIWebsocketTransport with TwilioFrameSerializer (mu-law 8kHz <-> PCM)
- Outbound call placement via Twilio REST API
- Call termination, DTMF, and transfer via REST API
"""
import os
from dataclasses import dataclass


@dataclass
class TwilioConfig:
    """Twilio configuration from environment variables."""
    account_sid: str = ""
    auth_token: str = ""
    phone_number: str = ""
    ws_public_url: str = ""

    @classmethod
    def from_env(cls) -> "TwilioConfig":
        return cls(
            account_sid=os.environ.get("TWILIO_ACCOUNT_SID", ""),
            auth_token=os.environ.get("TWILIO_AUTH_TOKEN", ""),
            phone_number=os.environ.get("TWILIO_PHONE_NUMBER", ""),
            ws_public_url=os.environ.get("HELLO_WS_PUBLIC_URL", ""),
        )

    def validate(self) -> list[str]:
        errors = []
        if not self.account_sid:
            errors.append("TWILIO_ACCOUNT_SID not set")
        if not self.auth_token:
            errors.append("TWILIO_AUTH_TOKEN not set")
        if not self.phone_number:
            errors.append("TWILIO_PHONE_NUMBER not set")
        if not self.ws_public_url:
            errors.append("HELLO_WS_PUBLIC_URL not set (public WebSocket URL for Twilio callback)")
        return errors


def create_twilio_transport(websocket, stream_sid: str):
    """Create FastAPIWebsocketTransport with TwilioFrameSerializer.

    Args:
        websocket: The accepted FastAPI WebSocket connection from Twilio
        stream_sid: Twilio stream SID from the 'start' event

    Pipecat handles mu-law 8kHz (Twilio) <-> PCM 16/24kHz (Gemini) conversion
    transparently via the serializer.
    """
    from pipecat.transports.services.fastapi_websocket import (
        FastAPIWebsocketTransport,
        FastAPIWebsocketParams,
    )
    from pipecat.serializers.twilio import TwilioFrameSerializer
    from pipecat.audio.vad.silero import SileroVADAnalyzer

    return FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_out_enabled=True,
            add_wav_header=False,
            vad_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
            vad_audio_passthrough=True,
            serializer=TwilioFrameSerializer(stream_sid),
        ),
    )


class TwilioCallManager:
    """Manages Twilio REST API operations for outbound calls.

    Uses a shared client instance to avoid re-authenticating on every call.
    """

    def __init__(self, config: TwilioConfig):
        self._config = config
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from twilio.rest import Client
            self._client = Client(self._config.account_sid, self._config.auth_token)
        return self._client

    def make_outbound_call(self, phone_number: str, call_id: str) -> str:
        """Place an outbound call. Returns Twilio call_sid.

        Flow: Twilio REST API -> TwiML <Connect><Stream> -> our WS endpoint
        """
        ws_url = f"{self._config.ws_public_url}/twilio/ws/{call_id}"
        twiml = (
            f'<Response>'
            f'<Connect><Stream url="{ws_url}"/></Connect>'
            f'</Response>'
        )
        call = self.client.calls.create(
            to=phone_number,
            from_=self._config.phone_number,
            twiml=twiml,
        )
        return call.sid

    def hangup(self, call_sid: str):
        """Terminate an active Twilio call."""
        self.client.calls(call_sid).update(status="completed")

    def send_dtmf(self, call_sid: str, digits: str, call_id: str):
        """Send DTMF tones via Twilio REST API.

        Briefly interrupts the media stream, plays the digits,
        then reconnects the stream. Known V1 limitation.
        """
        ws_url = f"{self._config.ws_public_url}/twilio/ws/{call_id}"
        twiml = (
            f'<Response>'
            f'<Play digits="{digits}"/>'
            f'<Connect><Stream url="{ws_url}"/></Connect>'
            f'</Response>'
        )
        self.client.calls(call_sid).update(twiml=twiml)

    def transfer(self, call_sid: str, target_number: str):
        """Transfer the call to another number. Ends the voice pipeline."""
        twiml = f'<Response><Dial>{target_number}</Dial></Response>'
        self.client.calls(call_sid).update(twiml=twiml)


def validate_config() -> dict:
    """Validate Twilio configuration without making a call."""
    config = TwilioConfig.from_env()
    errors = config.validate()
    if errors:
        return {"valid": False, "issues": errors}
    return {"valid": True, "message": "Twilio config valid"}
