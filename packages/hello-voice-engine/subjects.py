"""NATS subject constants for the HELLO voice engine."""


def event_subject(agent_id: str, event: str) -> str:
    return f"hello.{agent_id}.event.{event}"


def cmd_subject(agent_id: str, cmd: str) -> str:
    return f"hello.{agent_id}.cmd.{cmd}"


# Event types
USER_SPEECH = "user_speech"
AGENT_SPOKE = "agent_spoke"
TOOL_CALL = "tool_call"
CALL_STATE = "call_state"
INTERRUPTION = "interruption"
VAD = "vad"

# Command types
INJECT_CONTEXT = "inject_context"
SPEAK = "speak"
TRANSFER = "transfer"
END_CALL = "end_call"
SET_FLOW_NODE = "set_flow_node"
ENABLE_TOOLS = "enable_tools"
SEND_DTMF = "send_dtmf"

# Agent management subjects
AGENT_CREATE = "hello.agent.create"
AGENT_LIST = "hello.agent.list"
AGENT_START = "hello.agent.start"
AGENT_STOP = "hello.agent.stop"
AGENT_DELETE = "hello.agent.delete"
AGENT_CONFIG = "hello.agent.config"

# Call management
CALL_START = "hello.call.start"
CALL_MONITOR = "hello.call.monitor"
CALL_METRICS = "hello.call.metrics"
