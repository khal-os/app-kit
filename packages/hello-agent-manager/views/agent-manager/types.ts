export interface AgentConfig {
	id: string;
	name: string;
	slug: string;
	voice_id: string;
	language: string;
	model: string;
	system_prompt: string;
	flow_json: string | null;
	transport: string;
	max_duration_sec: number;
	max_concurrent: number;
	daily_budget_usd: number;
	status: 'stopped' | 'running' | 'error';
	created_at: string;
	updated_at: string;
}

export interface AgentMetrics {
	slug: string;
	cost_today_usd: number;
	calls_today: number;
	active_calls: number;
}
