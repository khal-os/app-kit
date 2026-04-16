'use client';

import type { ConnectionState } from '@khal-os/types';
import type { ConnectError } from './errors';

export type NatsMessageCallback = (data: unknown, subject: string) => void;
export type NatsStatusCallback = (connected: boolean) => void;
/**
 * Connection-state listener. When the transition carries a failure, `err`
 * is the typed `ConnectError` produced by the transport — callers branch on
 * `err.kind` to pick UX (sign-in CTA, retry, version-mismatch prompt, …).
 */
export type NatsConnectionStateListener = (state: ConnectionState, err?: ConnectError) => void;

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
