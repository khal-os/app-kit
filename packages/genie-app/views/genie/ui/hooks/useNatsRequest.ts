'use client';

import { getNatsClient } from '@khal-os/sdk/app';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseNatsRequestResult<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

/**
 * Generic hook for polling NATS request-reply subjects.
 * Returns { data, loading, error, refetch }.
 *
 * @param subject  NATS subject to request
 * @param payload  Optional request payload (stable reference recommended)
 * @param interval Polling interval in ms (default 5000, 0 to disable polling)
 */
export function useNatsRequest<T = unknown>(
	subject: string,
	payload?: unknown,
	interval = 5000
): UseNatsRequestResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mountedRef = useRef(true);

	// Stabilize payload by serializing — prevents infinite re-render loops
	// when callers pass inline objects like { name: teamName }
	const payloadKey = JSON.stringify(payload ?? null);
	const payloadRef = useRef(payload);
	payloadRef.current = payload;

	const fetchData = useCallback(async () => {
		try {
			const client = getNatsClient();
			const response = await client.request(subject, payloadRef.current ?? {}, 5000);
			if (!mountedRef.current) return;
			setData(response as T);
			setError(null);
		} catch (err) {
			if (!mountedRef.current) return;
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			if (mountedRef.current) {
				setLoading(false);
			}
		}
	}, [subject, payloadKey]);

	useEffect(() => {
		mountedRef.current = true;
		setLoading(true);
		fetchData();

		if (interval > 0) {
			intervalRef.current = setInterval(fetchData, interval);
		}

		return () => {
			mountedRef.current = false;
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchData, interval]);

	return { data, loading, error, refetch: fetchData };
}
