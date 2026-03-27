'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useKhalAuth } from './auth';
import { getNatsClient } from './nats-client';

/**
 * React hook for NATS pub/sub/request over the browser WebSocket bridge.
 *
 * Syncs the client's identity (orgId, userId) from the current auth state
 * and tracks connection status reactively via `useSyncExternalStore`.
 */
export function useNats() {
	const client = getNatsClient();
	const auth = useKhalAuth();
	const orgId = auth?.orgId ?? '';
	const userId = auth?.userId ?? '';

	// Keep the client's identity in sync with auth state
	useEffect(() => {
		if (orgId) client.setOrgId(orgId);
		if (userId) client.setUserId(userId);
	}, [client, orgId, userId]);

	// Track connection status reactively
	const connected = useSyncExternalStore(
		(callback) => client.onStatusChange(callback),
		() => client.connected,
		() => false // SSR snapshot
	);

	// subscribe: wraps client.subscribe, auto-unsubscribes on unmount
	const subscribe = useCallback(
		(subject: string, callback: (data: unknown, subject: string) => void) => {
			return client.subscribe(subject, callback);
		},
		[client]
	);

	// publish: fire-and-forget
	const publish = useCallback(
		(subject: string, data?: unknown) => {
			client.publish(subject, data);
		},
		[client]
	);

	// request: returns Promise<unknown>
	const request = useCallback(
		(subject: string, data?: unknown, timeoutMs?: number) => {
			return client.request(subject, data, timeoutMs);
		},
		[client]
	);

	return { connected, subscribe, publish, request, orgId, userId };
}

/** Convenience hook for subscribing in useEffect with auto-cleanup. */
export function useNatsSubscription(subject: string, callback: (data: unknown, subject: string) => void) {
	const { subscribe } = useNats();
	useEffect(() => {
		const unsub = subscribe(subject, callback);
		return unsub;
	}, [subject, callback, subscribe]);
}
