import type { AgentConfig } from './types';

export const SAC_ITAU_CARD_UNBLOCK: Omit<AgentConfig, 'id' | 'status'> = {
	name: 'SAC Itau - Card Unblock',
	slug: 'sac-itau-unblock',
	voice_id: 'Kore',
	language: 'pt-BR',
	model: 'gemini-3.1-flash-live-preview',
	system_prompt: `You are a customer service agent calling Itau bank to unblock a credit card.
Navigate the IVR menu to reach a human agent in the card department.
When asked for account info, wait for the operator to inject context.
Be polite, speak Brazilian Portuguese, and follow IVR prompts carefully.
If you reach a human agent, notify immediately so the operator can take over.`,
	targetNumber: '+551140043322',
	transport: 'twilio',
	max_duration_sec: 600,
	max_concurrent: 1,
	daily_budget_usd: 5.0,
};

export const DEFAULT_PRESETS: Omit<AgentConfig, 'id' | 'status'>[] = [SAC_ITAU_CARD_UNBLOCK];
