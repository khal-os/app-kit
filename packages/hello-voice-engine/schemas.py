"""Event and command schemas for the HELLO voice engine."""
from dataclasses import dataclass, field, asdict
from typing import Optional
import json


@dataclass
class UserSpeechEvent:
    text: str
    is_partial: bool = False
    timestamp: str = ""


@dataclass
class AgentSpokeEvent:
    text: str
    is_partial: bool = False
    timestamp: str = ""


@dataclass
class ToolCallEvent:
    name: str
    args: dict = field(default_factory=dict)
    call_id: str = ""


@dataclass
class CallStateEvent:
    state: str  # "ringing", "connected", "ended"
    duration: float = 0.0
    cost: float = 0.0


@dataclass
class InterruptionEvent:
    interrupted_text: str = ""


@dataclass
class VadEvent:
    speaking: bool = False


@dataclass
class InjectContextCmd:
    messages: list = field(default_factory=list)


@dataclass
class SpeakCmd:
    text: str = ""


@dataclass
class TransferCmd:
    phone_number: str = ""


@dataclass
class EndCallCmd:
    pass


@dataclass
class SetFlowNodeCmd:
    node_id: str = ""


@dataclass
class EnableToolsCmd:
    tool_names: list = field(default_factory=list)


@dataclass
class SendDtmfCmd:
    digits: str = ""


def to_json(obj) -> bytes:
    return json.dumps(asdict(obj)).encode()


def from_json(data: bytes, cls):
    return cls(**json.loads(data))
