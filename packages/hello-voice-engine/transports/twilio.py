"""Twilio outbound transport for voice calls."""
import os
from pipecat.transports.services.fastapi_websocket import FastAPIWebsocketTransport, FastAPIWebsocketParams
from pipecat.serializers.twilio import TwilioFrameSerializer


def create_twilio_transport() -> FastAPIWebsocketTransport:
    """Create a Twilio WebSocket transport for outbound calls."""
    return FastAPIWebsocketTransport(
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            serializer=TwilioFrameSerializer(),
        )
    )


async def place_outbound_call(to_number: str, stream_url: str) -> dict:
    """Place an outbound call via Twilio REST API.

    Args:
        to_number: E.164 phone number to call
        stream_url: WebSocket URL for media streaming

    Returns:
        dict with call_sid and status
    """
    try:
        from twilio.rest import Client
    except ImportError:
        return {"error": "twilio package not installed"}

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER")

    if not all([account_sid, auth_token, from_number]):
        return {"error": "Missing Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)"}

    client = Client(account_sid, auth_token)

    twiml = f"""
    <Response>
        <Connect>
            <Stream url="{stream_url}" />
        </Connect>
    </Response>
    """

    call = client.calls.create(
        to=to_number,
        from_=from_number,
        twiml=twiml,
    )

    return {"call_sid": call.sid, "status": call.status}


async def send_dtmf(call_sid: str, digits: str) -> dict:
    """Send DTMF digits to an active call via Twilio REST API."""
    try:
        from twilio.rest import Client
    except ImportError:
        return {"error": "twilio package not installed"}

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")

    client = Client(account_sid, auth_token)

    twiml = f'<Response><Play digits="{digits}"/></Response>'
    client.calls(call_sid).update(twiml=twiml)

    return {"ok": True, "digits": digits}


async def hangup_call(call_sid: str) -> dict:
    """Terminate a Twilio call."""
    try:
        from twilio.rest import Client
    except ImportError:
        return {"error": "twilio package not installed"}

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")

    client = Client(account_sid, auth_token)
    client.calls(call_sid).update(status="completed")

    return {"ok": True}


async def transfer_call(call_sid: str, to_number: str) -> dict:
    """Transfer an active call to another number."""
    try:
        from twilio.rest import Client
    except ImportError:
        return {"error": "twilio package not installed"}

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")

    client = Client(account_sid, auth_token)

    twiml = f'<Response><Dial>{to_number}</Dial></Response>'
    client.calls(call_sid).update(twiml=twiml)

    return {"ok": True, "transferred_to": to_number}


def validate_config() -> dict:
    """Validate Twilio configuration without making a call."""
    issues = []
    if not os.environ.get("TWILIO_ACCOUNT_SID"):
        issues.append("TWILIO_ACCOUNT_SID not set")
    if not os.environ.get("TWILIO_AUTH_TOKEN"):
        issues.append("TWILIO_AUTH_TOKEN not set")
    if not os.environ.get("TWILIO_PHONE_NUMBER"):
        issues.append("TWILIO_PHONE_NUMBER not set")

    if issues:
        return {"valid": False, "issues": issues}
    return {"valid": True, "message": "Twilio config valid"}
