'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getNatsClient } from './nats-client';
import { SUBJECTS } from './subjects';

// ── Types ──

export type SandboxState = 'none' | 'provisioning' | 'ready' | 'error' | 'deleting';

export interface SandboxStatus {
	state: SandboxState;
	/** User ID that owns this sandbox. */
	userId: string;
	/** App slug that triggered sandbox creation. */
	appSlug?: string;
	/** Error message when state is 'error'. */
	error?: string;
	/** Sandbox pod name in k8s (when provisioned). */
	podName?: string;
}

interface SandboxStatusResponse {
	status?: SandboxStatus;
	error?: string;
}

interface SandboxCreateResponse {
	ok?: boolean;
	error?: string;
}

// ── Imperative helpers ──

/**
 * Request sandbox creation for a user + app.
 * The backend handles k8s pod provisioning asynchronously.
 */
export async function createSandbox(userId: string, appSlug: string): Promise<void> {
	const client = getNatsClient();
	const raw = await client.request(SUBJECTS.sandbox.create, { userId, appSlug }, 30000);
	const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as SandboxCreateResponse;
	if (data.error) throw new Error(data.error);
}

/**
 * Request sandbox deletion for a user + app.
 */
export async function deleteSandbox(userId: string, appSlug: string): Promise<void> {
	const client = getNatsClient();
	const raw = await client.request(SUBJECTS.sandbox.delete, { userId, appSlug }, 15000);
	const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as SandboxCreateResponse;
	if (data.error) throw new Error(data.error);
}

/**
 * Query current sandbox status for a user.
 */
export async function getSandboxStatus(userId: string): Promise<SandboxStatus> {
	const client = getNatsClient();
	const raw = await client.request(SUBJECTS.sandbox.status, { userId }, 8000);
	const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as SandboxStatusResponse;
	if (data.error) throw new Error(data.error);
	return data.status ?? { state: 'none', userId };
}

// ── React hook ──

/**
 * Hook that tracks sandbox provisioning status for a user.
 * Subscribes to sandbox lifecycle events and polls for initial state.
 */
export function useSandboxStatus(userId: string | undefined): SandboxStatus | null {
	const [status, setStatus] = useState<SandboxStatus | null>(null);
	const userIdRef = useRef(userId);
	userIdRef.current = userId;

	// Fetch initial status
	useEffect(() => {
		if (!userId) {
			setStatus(null);
			return;
		}

		let cancelled = false;
		getSandboxStatus(userId)
			.then((s) => {
				if (!cancelled && userIdRef.current === userId) setStatus(s);
			})
			.catch(() => {
				// Backend may not have sandbox support yet — treat as 'none'
				if (!cancelled && userIdRef.current === userId) {
					setStatus({ state: 'none', userId });
				}
			});

		return () => { cancelled = true; };
	}, [userId]);

	// Subscribe to lifecycle events for real-time updates
	useEffect(() => {
		if (!userId) return;

		const client = getNatsClient();
		const subject = SUBJECTS.sandbox.events(userId);

		const unsub = client.subscribe(subject, (data: unknown) => {
			if (userIdRef.current !== userId) return;
			const event = (typeof data === 'string' ? JSON.parse(data) : data) as SandboxStatus;
			setStatus(event);
		});

		return () => { unsub(); };
	}, [userId]);

	return status;
}

/**
 * Returns sandbox-scoped PTY subject builders for a given org + user.
 * Terminal frontend uses these instead of the global PTY subjects
 * when connecting to a user's personal sandbox.
 */
export function sandboxPtySubjects(orgId: string, userId: string) {
	return {
		create: SUBJECTS.sandbox.pty.create(orgId, userId),
		destroy: SUBJECTS.sandbox.pty.destroy(orgId, userId),
		list: SUBJECTS.sandbox.pty.list(orgId, userId),
		data: (sessionId: string) => SUBJECTS.sandbox.pty.data(orgId, userId, sessionId),
		input: (sessionId: string) => SUBJECTS.sandbox.pty.input(orgId, userId, sessionId),
		resize: (sessionId: string) => SUBJECTS.sandbox.pty.resize(orgId, userId, sessionId),
		exit: (sessionId: string) => SUBJECTS.sandbox.pty.exit(orgId, userId, sessionId),
	};
}
