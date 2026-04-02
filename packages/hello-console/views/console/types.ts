export interface AgentInfo {
	id: string;
	slug: string;
	name: string;
	status: string;
	voice_id: string;
	language: string;
}

export interface TranscriptEntry {
	id: string;
	role: 'user' | 'agent';
	text: string;
	isPartial: boolean;
	timestamp: string;
}

export interface EventEntry {
	id: string;
	type: string;
	message: string;
	timestamp: string;
}

export interface MetricDataPoint {
	timestamp: string;
	value: number;
}

export interface TokenMetrics {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

export interface MetricsState {
	ttfb: Record<string, MetricDataPoint[]>;
	tokenUsage: TokenMetrics;
	turnCount: number;
}

export interface FunctionCallEntry {
	id: string;
	name: string;
	args: unknown;
	result: unknown;
	status: 'in_progress' | 'completed' | 'error';
	timestamp: string;
}

export interface VadState {
	speaking: boolean;
}
