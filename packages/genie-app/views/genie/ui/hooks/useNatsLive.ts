'use client';

import { getNatsClient } from '@khal-os/sdk/app';
import { useWindowActive } from '@khal-os/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseNatsLiveOptions {
	requestSubject: string;
	changeSubject: string;
	payload?: unknown;
	/** If true, use pushed data directly. If false, re-request on change. Default: true */
	usePushPayload?: boolean;
}

interface UseNatsLiveResult<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
}

/**
 * Zero-polling hook that fetches initial data via NATS request-reply,
 * then subscribes to a change subject for push updates.
 *
 * When the window loses focus (app-nap), the subscription is paused.
 * On refocus the hook re-subscribes and refetches current state.
 */
export function useNatsLive<T = unknown>(opts: UseNatsLiveOptions): UseNatsLiveResult<T> {
	const { requestSubject, changeSubject, payload, usePushPayload = true } = opts;

	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const mountedRef = useRef(true);
	const windowActive = useWindowActive();

	// Stabilize payload to prevent infinite re-render loops
	const payloadKey = JSON.stringify(payload ?? null);
	const payloadRef = useRef(payload);
	payloadRef.current = payload;

	const fetchData = useCallback(async () => {
		try {
			const client = getNatsClient();
			const response = await client.request(requestSubject, payloadRef.current ?? {}, 5000);
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
	}, [requestSubject, payloadKey]);

	// Single effect: subscribe when active, unsubscribe when inactive or unmount.
	// Re-fetches on mount, on subject/payload change, and on window refocus.
	useEffect(() => {
		mountedRef.current = true;

		if (!windowActive) return;

		// Fetch current state (initial load or catch up after refocus)
		fetchData();

		// Subscribe to change subject for push updates
		const client = getNatsClient();
		const unsub = client.subscribe(changeSubject, (pushData: unknown) => {
			if (!mountedRef.current) return;
			if (usePushPayload) {
				setData(pushData as T);
				setError(null);
			} else {
				fetchData();
			}
		});

		return () => {
			mountedRef.current = false;
			unsub();
		};
	}, [windowActive, changeSubject, fetchData, usePushPayload]);

	return { data, loading, error, refetch: fetchData };
}
