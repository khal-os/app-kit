'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNats } from '@/lib/hooks/use-nats';
import type { EventEntry, FunctionCallEntry, MetricsState, TranscriptEntry, VadState } from '../types';

interface AgentStreamState {
	transcript: TranscriptEntry[];
	events: EventEntry[];
	metrics: MetricsState;
	functionCalls: FunctionCallEntry[];
	vadState: VadState;
	connected: boolean;
}

const initialMetrics: MetricsState = {
	ttfb: {},
	tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
	turnCount: 0,
};

export function useAgentStream(agentId: string | null) {
	const { subscribe, connected: natsConnected } = useNats();
	const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
	const [events, setEvents] = useState<EventEntry[]>([]);
	const [metrics, setMetrics] = useState<MetricsState>(initialMetrics);
	const [functionCalls, setFunctionCalls] = useState<FunctionCallEntry[]>([]);
	const [vadState, setVadState] = useState<VadState>({ speaking: false });
	const [connected, setConnected] = useState(false);
	const eventIdRef = useRef(0);

	const clearAll = useCallback(() => {
		setTranscript([]);
		setEvents([]);
		setMetrics(initialMetrics);
		setFunctionCalls([]);
		setVadState({ speaking: false });
		eventIdRef.current = 0;
	}, []);

	useEffect(() => {
		if (!agentId || !natsConnected) {
			setConnected(false);
			return;
		}

		clearAll();
		setConnected(true);

		const unsub = subscribe(`hello.${agentId}.event.*`, (data: unknown, subject: string) => {
			const eventType = subject.split('.').pop() ?? '';
			const payload = data as Record<string, unknown>;
			const timestamp = (payload.timestamp as string) ?? new Date().toISOString();

			// Add to events log (cap at 1000)
			setEvents((prev) => {
				const entry: EventEntry = {
					id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
					type: eventType,
					message: summarizeEvent(eventType, payload),
					timestamp,
				};
				const next = [...prev, entry];
				return next.length > 1000 ? next.slice(-1000) : next;
			});

			switch (eventType) {
				case 'user_speech':
					handleSpeech('user', payload, setTranscript);
					break;
				case 'agent_spoke':
					handleSpeech('agent', payload, setTranscript, setMetrics);
					break;
				case 'tool_call':
					handleToolCall(payload, setFunctionCalls);
					break;
				case 'call_state':
					handleCallState(payload, setMetrics);
					break;
				case 'interruption':
					// Logged in events, no special handling
					break;
				case 'vad':
					setVadState({ speaking: Boolean(payload.speaking) });
					break;
			}
		});

		return () => {
			unsub();
			setConnected(false);
		};
	}, [agentId, natsConnected, subscribe, clearAll]);

	return {
		transcript,
		events,
		metrics,
		functionCalls,
		vadState,
		connected,
		clearAll,
	} satisfies AgentStreamState & { clearAll: () => void };
}

function handleSpeech(
	role: 'user' | 'agent',
	payload: Record<string, unknown>,
	setTranscript: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>,
	setMetrics?: React.Dispatch<React.SetStateAction<MetricsState>>
) {
	const text = (payload.text as string) ?? '';
	const isPartial = Boolean(payload.is_partial);

	setTranscript((prev) => {
		// If partial, update the last entry of the same role if it was also partial
		if (isPartial) {
			const lastIdx = prev.length - 1;
			if (lastIdx >= 0 && prev[lastIdx].role === role && prev[lastIdx].isPartial) {
				const updated = [...prev];
				updated[lastIdx] = { ...updated[lastIdx], text, isPartial: true };
				return updated;
			}
		} else {
			// Final: check if we're completing a partial
			const lastIdx = prev.length - 1;
			if (lastIdx >= 0 && prev[lastIdx].role === role && prev[lastIdx].isPartial) {
				const updated = [...prev];
				updated[lastIdx] = { ...updated[lastIdx], text, isPartial: false };
				// Increment turn count on final agent speech
				if (role === 'agent' && setMetrics) {
					setMetrics((m) => ({ ...m, turnCount: m.turnCount + 1 }));
				}
				return updated;
			}
		}

		// New entry
		const entry: TranscriptEntry = {
			id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			role,
			text,
			isPartial,
			timestamp: (payload.timestamp as string) ?? new Date().toISOString(),
		};

		if (!isPartial && role === 'agent' && setMetrics) {
			setMetrics((m) => ({ ...m, turnCount: m.turnCount + 1 }));
		}

		const next = [...prev, entry];
		return next.length > 500 ? next.slice(-500) : next;
	});
}

function handleToolCall(
	payload: Record<string, unknown>,
	setFunctionCalls: React.Dispatch<React.SetStateAction<FunctionCallEntry[]>>
) {
	const callId = (payload.call_id as string) ?? '';
	const name = (payload.name as string) ?? 'unknown';

	setFunctionCalls((prev) => {
		// Check if we already have this call (update with result)
		const existingIdx = prev.findIndex((fc) => fc.id === callId);
		if (existingIdx >= 0) {
			const updated = [...prev];
			updated[existingIdx] = {
				...updated[existingIdx],
				result: payload.result ?? updated[existingIdx].result,
				status: payload.error ? 'error' : payload.result ? 'completed' : 'in_progress',
			};
			return updated;
		}

		// New function call
		return [
			...prev,
			{
				id: callId || `fc-${Date.now()}`,
				name,
				args: payload.args ?? {},
				result: payload.result ?? null,
				status: payload.result ? 'completed' : payload.error ? 'error' : 'in_progress',
				timestamp: (payload.timestamp as string) ?? new Date().toISOString(),
			},
		];
	});
}

function handleCallState(
	payload: Record<string, unknown>,
	setMetrics: React.Dispatch<React.SetStateAction<MetricsState>>
) {
	const metricsData = payload.metrics as Record<string, unknown> | undefined;
	if (!metricsData) return;

	setMetrics((prev) => {
		const next = { ...prev };

		// TTFB data
		const ttfbArr = metricsData.ttfb as Array<{ processor: string; value: number }> | undefined;
		if (ttfbArr) {
			const ttfb = { ...prev.ttfb };
			for (const entry of ttfbArr) {
				const points = ttfb[entry.processor] ?? [];
				const newPoint = {
					timestamp: new Date().toISOString(),
					value: entry.value,
				};
				const updated = [...points, newPoint];
				ttfb[entry.processor] = updated.length > 50 ? updated.slice(-50) : updated;
			}
			next.ttfb = ttfb;
		}

		// Token usage
		const tokens = metricsData.tokens as Record<string, number> | undefined;
		if (tokens) {
			next.tokenUsage = {
				prompt_tokens: tokens.prompt_tokens ?? prev.tokenUsage.prompt_tokens,
				completion_tokens: tokens.completion_tokens ?? prev.tokenUsage.completion_tokens,
				total_tokens: tokens.total_tokens ?? prev.tokenUsage.total_tokens,
			};
		}

		return next;
	});
}

function summarizeEvent(type: string, payload: Record<string, unknown>): string {
	switch (type) {
		case 'user_speech':
			return (payload.text as string) ?? '';
		case 'agent_spoke':
			return (payload.text as string) ?? '';
		case 'tool_call':
			return `${payload.name ?? 'unknown'}(${JSON.stringify(payload.args ?? {}).slice(0, 80)})`;
		case 'call_state':
			return `State: ${payload.state ?? 'unknown'}`;
		case 'interruption':
			return `Interrupted: "${(payload.interrupted_text as string)?.slice(0, 50) ?? ''}"`;
		case 'vad':
			return payload.speaking ? 'Speaking' : 'Silent';
		default:
			return JSON.stringify(payload).slice(0, 100);
	}
}
