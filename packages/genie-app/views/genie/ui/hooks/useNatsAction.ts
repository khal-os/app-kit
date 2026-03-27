'use client';

import { getNatsClient } from '@khal-os/sdk/app';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseNatsActionResult<T> {
	execute: (payload?: unknown) => Promise<T>;
	loading: boolean;
	error: string | null;
}

/**
 * Generic hook for one-shot NATS mutations (kill, stop, create, etc.).
 * Returns { execute, loading, error }.
 *
 * @param subject NATS subject to request
 */
export function useNatsAction<T = unknown>(subject: string): UseNatsActionResult<T> {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const execute = useCallback(
		async (payload?: unknown): Promise<T> => {
			setLoading(true);
			setError(null);
			try {
				const client = getNatsClient();
				const response = await client.request(subject, payload ?? {}, 10000);
				if (mountedRef.current) {
					setLoading(false);
				}
				return response as T;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				if (mountedRef.current) {
					setError(message);
					setLoading(false);
				}
				throw err;
			}
		},
		[subject]
	);

	return { execute, loading, error };
}
