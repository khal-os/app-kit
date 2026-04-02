/* ── NATS subject helpers — mirrors the hello-voice-engine contract ── */

// Event types (subscribe)
export const USER_SPEECH = 'user_speech';
export const AGENT_SPOKE = 'agent_spoke';
export const TOOL_CALL = 'tool_call';
export const CALL_STATE = 'call_state';
export const INTERRUPTION = 'interruption';
export const VAD = 'vad';

// Command types (publish)
export const INJECT_CONTEXT = 'inject_context';
export const SPEAK = 'speak';
export const TRANSFER = 'transfer';
export const END_CALL = 'end_call';
export const SEND_DTMF = 'send_dtmf';
export const SET_FLOW_NODE = 'set_flow_node';
export const ENABLE_TOOLS = 'enable_tools';

/** Build an event subject: `hello.{agentId}.event.{type}` */
export function event(agentId: string, type: string): string {
	return `hello.${agentId}.event.${type}`;
}

/** Build a command subject: `hello.{agentId}.cmd.{type}` */
export function cmd(agentId: string, type: string): string {
	return `hello.${agentId}.cmd.${type}`;
}

/** Subscribe to all events for an agent: `hello.{agentId}.event.*` */
export function allEvents(agentId: string): string {
	return `hello.${agentId}.event.*`;
}

// ── Agent management (request/reply) ──
export const AGENT_LIST = 'hello.agent.list';
export const AGENT_CONFIG = 'hello.agent.config';
export const AGENT_START = 'hello.agent.start';
export const AGENT_STOP = 'hello.agent.stop';

// ── Call management (request/reply) ──
export const CALL_START = 'hello.call.start';
export const CALL_HANGUP = 'hello.call.hangup';
export const CALL_DTMF = 'hello.call.dtmf';
export const CALL_TRANSFER = 'hello.call.transfer';
export const CALL_METRICS = 'hello.call.metrics';
