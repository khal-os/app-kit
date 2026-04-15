'use client';

import type { ConnectionState } from '@khal-os/types';

export type NatsMessageCallback = (data: unknown, subject: string) => void;
export type NatsStatusCallback = (connected: boolean) => void;
export type NatsConnectionStateListener = (state: ConnectionState, detail?: Record<string, unknown>) => void;

/**
 * Placeholder for the typed ConnectError taxonomy.
 * TODO(G4): replace with the shared `ConnectError` union from `./errors`.
 */
export type ConnectErrorPlaceholder =
	| { kind: 'unauthenticated' }
	| { kind: 'token-expired' }
	| { kind: 'origin-rejected' }
	| { kind: 'version-mismatch'; required?: string }
	| { kind: 'network-unreachable'; detail?: string }
	| { kind: 'no-config' };

/**
 * Shared transport interface implemented by `TauriNatsClient` (IPC → Rust relay)
 * and `BrowserNatsClient` (direct WebSocket). The factory `getNatsClient()`
 * picks the right implementation at runtime based on `window.__TAURI__`.
 */
export interface NatsClientTransport {
	readonly connected: boolean;
	readonly orgId: string;
	readonly userId: string;
	readonly connectionState: ConnectionState;

	setOrgId(orgId: string): void;
	setUserId(userId: string): void;

	onStatusChange(callback: NatsStatusCallback): () => void;
	onConnectionStateChange(listener: NatsConnectionStateListener): () => void;

	subscribe(subject: string, callback: NatsMessageCallback): () => void;
	publish(subject: string, data?: unknown): void;
	request(subject: string, data?: unknown, timeoutMs?: number): Promise<unknown>;
}

/**
 * Match a concrete NATS subject against a subscription pattern.
 *  - `*` matches exactly one token
 *  - `>` (must be last token) matches one or more tokens
 *  - everything else is a literal match
 */
export function subjectMatches(pattern: string, subject: string): boolean {
	if (pattern === subject) return true;

	const patParts = pattern.split('.');
	const subParts = subject.split('.');

	for (let i = 0; i < patParts.length; i++) {
		const p = patParts[i];
		if (p === '>') return i === patParts.length - 1 && subParts.length > i;
		if (i >= subParts.length) return false;
		if (p !== '*' && p !== subParts[i]) return false;
	}

	return patParts.length === subParts.length;
}
