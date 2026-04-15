'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useKhalAuth } from './auth';
import { getNatsClient } from './nats-client-factory';

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

// ---------------------------------------------------------------------------
// useService — transport-agnostic service communication hook
// ---------------------------------------------------------------------------

/** Transport mode for service communication. */
type ServiceTransport = 'nats' | 'tauri-ipc';

/** Service connection info returned by useService. */
interface ServiceConnection {
	/** Whether the transport is connected. */
	connected: boolean;
	/** Current transport mode. */
	transport: ServiceTransport;
	/** Send a request to the service and get a response. */
	request: (action: string, data?: unknown, timeoutMs?: number) => Promise<unknown>;
	/** Publish a message to the service (fire-and-forget). */
	publish: (action: string, data?: unknown) => void;
	/** Subscribe to service events. Returns unsubscribe function. */
	subscribe: (event: string, callback: (data: unknown) => void) => () => void;
	/** Service port mappings (from port proxy). */
	ports: Array<{ internalPort: number; proxyPort: number }>;
	/** Get the proxied URL for a service port. */
	getUrl: (internalPort: number) => string | null;
}

/**
 * Detect the current transport mode.
 * In Tauri, window.__TAURI__ is defined.
 */
function detectTransport(): ServiceTransport {
	if (typeof window !== 'undefined' && '__TAURI__' in window) {
		return 'tauri-ipc';
	}
	return 'nats';
}

/**
 * React hook for communicating with a Khal OS service.
 *
 * Abstracts the transport layer: uses NATS in Khal OS mode,
 * and Tauri IPC in standalone desktop mode.
 *
 * @param appId - The app ID (used as NATS prefix)
 * @example
 * ```tsx
 * const svc = useService('genie');
 * const result = await svc.request('agents.list', { status: 'active' });
 * ```
 */
export function useService(appId: string): ServiceConnection {
	const transport = detectTransport();

	if (transport === 'nats') {
		return useNatsService(appId);
	}
	return useTauriService(appId);
}

/** NATS-based service connection (Khal OS mode). */
function useNatsService(appId: string): ServiceConnection {
	const { connected, request: natsRequest, publish: natsPublish, subscribe: natsSubscribe, orgId } = useNats();
	const [ports, setPorts] = useState<Array<{ internalPort: number; proxyPort: number }>>([]);

	// Fetch port mappings on connect
	useEffect(() => {
		if (!connected) return;
		natsRequest(`khal.${orgId}.services.ports.${appId}`, {})
			.then((reply) => setPorts((reply as { ports?: typeof ports }).ports ?? []))
			.catch(() => {});
	}, [connected, orgId, appId, natsRequest]);

	const request = useCallback(
		(action: string, data?: unknown, timeoutMs?: number) => {
			return natsRequest(`khal.${orgId}.${appId}.${action}`, data, timeoutMs);
		},
		[natsRequest, orgId, appId]
	);

	const publish = useCallback(
		(action: string, data?: unknown) => {
			natsPublish(`khal.${orgId}.${appId}.${action}`, data);
		},
		[natsPublish, orgId, appId]
	);

	const subscribe = useCallback(
		(event: string, callback: (data: unknown) => void) => {
			return natsSubscribe(`khal.${orgId}.${appId}.events.${event}`, callback);
		},
		[natsSubscribe, orgId, appId]
	);

	const getUrl = useCallback(
		(internalPort: number) => {
			const mapping = ports.find((p) => p.internalPort === internalPort);
			return mapping ? `http://127.0.0.1:${mapping.proxyPort}` : null;
		},
		[ports]
	);

	return { connected, transport: 'nats', request, publish, subscribe, ports, getUrl };
}

type TauriWindow = {
	__TAURI__: {
		core: { invoke: (...args: unknown[]) => Promise<unknown> };
		event: { listen: (...args: unknown[]) => Promise<() => void> };
	};
};

function getTauri() {
	if (typeof window !== 'undefined' && '__TAURI__' in window) {
		return (window as unknown as TauriWindow).__TAURI__;
	}
	return null;
}

/** Tauri IPC-based service connection (standalone mode). */
function useTauriService(appId: string): ServiceConnection {
	// Stub implementation — Tauri IPC bridge will be implemented in Wave 4
	const request = useCallback(
		async (action: string, data?: unknown) => {
			const tauri = getTauri();
			if (tauri) {
				return tauri.core.invoke('service_request', { appId, action, data: JSON.stringify(data ?? {}) });
			}
			throw new Error('Tauri IPC not available');
		},
		[appId]
	);

	const publish = useCallback(
		(action: string, data?: unknown) => {
			const tauri = getTauri();
			if (tauri) {
				tauri.core.invoke('service_publish', { appId, action, data: JSON.stringify(data ?? {}) }).catch(() => {});
			}
		},
		[appId]
	);

	const subscribe = useCallback(
		(event: string, callback: (data: unknown) => void) => {
			const tauri = getTauri();
			if (tauri) {
				const unlisten = tauri.event.listen(`${appId}:${event}`, (e: { payload: unknown }) => callback(e.payload));
				return () => {
					unlisten.then((fn: () => void) => fn());
				};
			}
			return () => {};
		},
		[appId]
	);

	const getUrl = useCallback(() => null, []);

	return { connected: true, transport: 'tauri-ipc', request, publish, subscribe, ports: [], getUrl };
}
