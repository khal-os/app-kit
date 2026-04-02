'use client';

import { useNats } from '@khal-os/sdk/app';
import { useCallback, useEffect, useRef, useState } from 'react';
import { allEvents } from '../subjects';
import type { TranscriptEntry } from '../types';

const MAX_ENTRIES = 500;

export function useTranscript(agentId: string | null) {
	const { subscribe } = useNats();
	const [entries, setEntries] = useState<TranscriptEntry[]>([]);
	const idRef = useRef(0);

	const clear = useCallback(() => {
		setEntries([]);
		idRef.current = 0;
	}, []);

	useEffect(() => {
		if (!agentId) {
			clear();
			return;
		}

		clear();

		const unsub = subscribe(allEvents(agentId), (data: unknown, subject: string) => {
			const eventType = subject.split('.').pop() ?? '';
			const payload = data as Record<string, unknown>;
			const timestamp = (payload.timestamp as string) ?? new Date().toISOString();

			switch (eventType) {
				case 'user_speech':
					handleSpeech('user', payload, timestamp, setEntries, idRef);
					break;
				case 'agent_spoke':
					handleSpeech('agent', payload, timestamp, setEntries, idRef);
					break;
				case 'tool_call':
					handleToolCall(payload, timestamp, setEntries, idRef);
					break;
				case 'call_state':
					handleStateChange(payload, timestamp, setEntries, idRef);
					break;
				case 'interruption':
					handleInterruption(payload, timestamp, setEntries, idRef);
					break;
			}
		});

		return unsub;
	}, [agentId, subscribe, clear]);

	return { entries, clear };
}

function nextId(ref: React.RefObject<number>): string {
	ref.current = (ref.current ?? 0) + 1;
	return `tr-${ref.current}`;
}

function handleSpeech(
	type: 'user' | 'agent',
	payload: Record<string, unknown>,
	timestamp: string,
	setEntries: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>,
	idRef: React.RefObject<number>
) {
	const text = (payload.text as string) ?? '';
	const isPartial = Boolean(payload.is_partial);

	setEntries((prev) => {
		// Update last partial of same type in-place
		if (isPartial) {
			const lastIdx = prev.length - 1;
			if (lastIdx >= 0 && prev[lastIdx].type === type && prev[lastIdx].isPartial) {
				const updated = [...prev];
				updated[lastIdx] = { ...updated[lastIdx], text, isPartial: true };
				return updated;
			}
		} else {
			// Finalize partial
			const lastIdx = prev.length - 1;
			if (lastIdx >= 0 && prev[lastIdx].type === type && prev[lastIdx].isPartial) {
				const updated = [...prev];
				updated[lastIdx] = { ...updated[lastIdx], text, isPartial: false };
				return updated;
			}
		}

		// New entry
		const entry: TranscriptEntry = {
			id: nextId(idRef),
			type,
			text,
			timestamp,
			isPartial,
		};

		const next = [...prev, entry];
		return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
	});
}

function handleToolCall(
	payload: Record<string, unknown>,
	timestamp: string,
	setEntries: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>,
	idRef: React.RefObject<number>
) {
	const name = (payload.name as string) ?? 'unknown';
	const args = payload.args;
	const text = `${name}(${JSON.stringify(args ?? {}).slice(0, 120)})`;

	setEntries((prev) => {
		const entry: TranscriptEntry = {
			id: nextId(idRef),
			type: 'tool',
			text,
			timestamp,
			isPartial: false,
			toolName: name,
			toolArgs: args,
		};
		const next = [...prev, entry];
		return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
	});
}

function handleStateChange(
	payload: Record<string, unknown>,
	timestamp: string,
	setEntries: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>,
	idRef: React.RefObject<number>
) {
	const state = (payload.state as string) ?? 'unknown';
	const text = `Call state: ${state}`;

	setEntries((prev) => {
		const entry: TranscriptEntry = {
			id: nextId(idRef),
			type: 'state',
			text,
			timestamp,
			isPartial: false,
		};
		const next = [...prev, entry];
		return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
	});
}

function handleInterruption(
	payload: Record<string, unknown>,
	timestamp: string,
	setEntries: React.Dispatch<React.SetStateAction<TranscriptEntry[]>>,
	idRef: React.RefObject<number>
) {
	const interruptedText = (payload.interrupted_text as string) ?? '';
	const text = interruptedText;

	setEntries((prev) => {
		const entry: TranscriptEntry = {
			id: nextId(idRef),
			type: 'interruption',
			text,
			timestamp,
			isPartial: false,
		};
		const next = [...prev, entry];
		return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
	});
}
