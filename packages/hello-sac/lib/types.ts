export interface TranscriptEntry {
	id: string;
	type: 'user' | 'agent' | 'tool' | 'state' | 'interruption';
	text: string;
	timestamp: string;
	isPartial: boolean;
	/** Tool-call metadata (only when type === 'tool') */
	toolName?: string;
	toolArgs?: unknown;
}

export type CallStatus = 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended';

export interface CallState {
	status: CallStatus;
	duration: number;
	agentId: string | null;
	callId: string | null;
}

export interface AgentConfig {
	id: string;
	name: string;
	slug: string;
	voice_id: string;
	language: string;
	model?: string;
	system_prompt: string;
	flow_json?: string;
	transport?: string;
	targetNumber?: string;
	max_duration_sec?: number;
	max_concurrent?: number;
	daily_budget_usd?: number;
	status?: string;
}

export interface AgentInfo {
	id: string;
	slug: string;
	name: string;
	status: string;
	voice_id: string;
	language: string;
}
