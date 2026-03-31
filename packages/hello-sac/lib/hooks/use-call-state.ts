'use client';

import { useNats } from '@khal-os/sdk/app';
import { useEffect, useRef, useState } from 'react';
import { CALL_STATE, event } from '../subjects';
import type { CallState, CallStatus } from '../types';

const INITIAL_STATE: CallState = {
	status: 'idle',
	duration: 0,
	agentId: null,
	callId: null,
};

export function useCallState(agentId: string | null) {
	const { subscribe } = useNats();
	const [callState, setCallState] = useState<CallState>(INITIAL_STATE);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const connectedAtRef = useRef<number | null>(null);

	// Timer for counting call duration
	useEffect(() => {
		if (callState.status === 'connected') {
			if (!connectedAtRef.current) {
				connectedAtRef.current = Date.now();
			}
			timerRef.current = setInterval(() => {
				const elapsed = Math.floor((Date.now() - (connectedAtRef.current ?? Date.now())) / 1000);
				setCallState((prev) => ({ ...prev, duration: elapsed }));
			}, 1000);
		} else {
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
			if (callState.status === 'idle' || callState.status === 'ended') {
				connectedAtRef.current = null;
			}
		}

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [callState.status]);

	// Subscribe to call_state events
	useEffect(() => {
		if (!agentId) {
			setCallState(INITIAL_STATE);
			return;
		}

		const unsub = subscribe(event(agentId, CALL_STATE), (data: unknown) => {
			const payload = data as Record<string, unknown>;
			const status = (payload.state as CallStatus) ?? 'idle';
			setCallState((prev) => ({
				...prev,
				status,
				agentId,
				callId: (payload.call_id as string) ?? prev.callId,
			}));
		});

		return unsub;
	}, [agentId, subscribe]);

	const reset = () => {
		setCallState(INITIAL_STATE);
		connectedAtRef.current = null;
	};

	return { callState, reset };
}
