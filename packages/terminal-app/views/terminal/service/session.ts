import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NatsConnection } from '@nats-io/transport-node';
import * as pty from 'node-pty';
import { SUBJECTS } from '@/lib/subjects';
import type {
	PtyBufferEndMessage,
	PtyBufferMessage,
	PtyCreateRequest,
	PtyCreateResponse,
	PtyDataMessage,
	PtyExitMessage,
	PtyListResponse,
} from '../schema';

const SHELL = process.env.SHELL || '/bin/bash';
const MAX_BUFFER_BYTES = parseInt(process.env.PTY_MAX_BUFFER_BYTES || '1048576', 10); // 1MB
const SESSION_TTL_MS = parseInt(process.env.PTY_SESSION_TTL_MS || '259200000', 10); // 72h
const CLEANUP_INTERVAL_MS = 3600000; // 1 hour

const __dir = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const BASHRC_HOOK_PATH = resolve(__dir, 'shell-hooks', 'bashrc-hook.sh');

interface PTYSession {
	sessionId: string;
	ownerId: string;
	process: pty.IPty;
	buffer: Buffer[];
	bufferBytes: number;
	createdAt: number;
	lastActivity: number;
	subscribers: number;
}

function addToBuffer(session: PTYSession, data: string): void {
	const chunk = Buffer.from(data, 'utf8');
	session.buffer.push(chunk);
	session.bufferBytes += chunk.length;

	// Enforce byte cap by removing oldest chunks
	while (session.bufferBytes > MAX_BUFFER_BYTES && session.buffer.length > 0) {
		const removed = session.buffer.shift();
		if (removed) {
			session.bufferBytes -= removed.length;
		}
	}

	session.lastActivity = Date.now();
}

export function createSessionManager(nc: NatsConnection, orgId = 'default') {
	const sessions = new Map<string, PTYSession>();
	let cleanupTimer: ReturnType<typeof setInterval> | null = null;

	function createSession(request: PtyCreateRequest, userId: string): PtyCreateResponse {
		const sessionId = request.sessionId || randomUUID();
		const cols = request.cols || 80;
		const rows = request.rows || 24;

		console.log(`[pty] Creating session ${sessionId} (user=${userId}) -- spawning ${SHELL}`);

		// Determine shell args -- for bash, use --rcfile for OSC integration
		let shellArgs: string[] = [];
		const shellName = SHELL.split('/').pop();
		if (shellName === 'bash') {
			shellArgs = ['--rcfile', BASHRC_HOOK_PATH];
		}

		const ptyProcess = pty.spawn(SHELL, shellArgs, {
			name: 'xterm-256color',
			cols,
			rows,
			cwd: process.env.HOME || '/home/genie',
			env: {
				...(process.env as Record<string, string>),
				TERM: 'xterm-256color',
				COLORTERM: 'truecolor',
			},
		});

		const session: PTYSession = {
			sessionId,
			ownerId: userId,
			process: ptyProcess,
			buffer: [],
			bufferBytes: 0,
			createdAt: Date.now(),
			lastActivity: Date.now(),
			subscribers: 0,
		};

		// PTY output -> buffer + publish to NATS
		ptyProcess.onData((data: string) => {
			addToBuffer(session, data);

			const msg: PtyDataMessage = {
				sessionId,
				data: Buffer.from(data, 'utf8').toString('base64'),
			};
			nc.publish(SUBJECTS.pty.data(orgId, sessionId), JSON.stringify(msg));
		});

		// PTY exit -> publish exit message + cleanup
		ptyProcess.onExit(({ exitCode, signal }) => {
			console.log(`[pty] Session ${sessionId} exited (code=${exitCode}, signal=${signal})`);

			const msg: PtyExitMessage = {
				sessionId,
				code: exitCode,
				...(signal !== undefined ? { signal } : {}),
			};
			nc.publish(SUBJECTS.pty.exit(orgId, sessionId), JSON.stringify(msg));

			sessions.delete(sessionId);
		});

		sessions.set(sessionId, session);

		return { sessionId, created: true };
	}

	function destroySession(sessionId: string, userId?: string): boolean {
		const session = sessions.get(sessionId);
		if (!session) return false;

		// Strict ownership: if session has an owner, userId must match
		if (session.ownerId && (!userId || session.ownerId !== userId)) {
			console.warn(
				`[pty] Ownership check failed: user ${userId || '<empty>'} tried to destroy session ${sessionId} owned by ${session.ownerId}`
			);
			return false;
		}

		console.log(`[pty] Destroying session ${sessionId}`);

		try {
			session.process.kill();
		} catch (err) {
			console.error(`[pty] Error killing PTY ${sessionId}:`, (err as Error).message);
		}

		sessions.delete(sessionId);
		return true;
	}

	function replayBuffer(sessionId: string, userId?: string): boolean {
		const session = sessions.get(sessionId);
		if (!session) return false;

		if (session.ownerId && (!userId || session.ownerId !== userId)) {
			console.warn(
				`[pty] Ownership check failed: user ${userId || '<empty>'} tried to replay session ${sessionId} owned by ${session.ownerId}`
			);
			// Send buffer-end with error so the client doesn't hang
			const endMsg: PtyBufferEndMessage = { sessionId, error: 'access_denied' };
			nc.publish(SUBJECTS.pty.bufferEnd(orgId, sessionId), JSON.stringify(endMsg));
			return false;
		}

		// Publish each buffered chunk as base64
		for (const chunk of session.buffer) {
			const msg: PtyBufferMessage = {
				sessionId,
				data: chunk.toString('base64'),
			};
			nc.publish(SUBJECTS.pty.buffer(orgId, sessionId), JSON.stringify(msg));
		}

		// Signal end of buffer replay
		const endMsg: PtyBufferEndMessage = { sessionId };
		nc.publish(SUBJECTS.pty.bufferEnd(orgId, sessionId), JSON.stringify(endMsg));

		return true;
	}

	function resizeSession(sessionId: string, cols: number, rows: number, userId?: string): boolean {
		const session = sessions.get(sessionId);
		if (!session) return false;

		if (session.ownerId && (!userId || session.ownerId !== userId)) {
			console.warn(
				`[pty] Ownership check failed: user ${userId || '<empty>'} tried to resize session ${sessionId} owned by ${session.ownerId}`
			);
			return false;
		}

		const newCols = Math.max(1, Math.floor(cols));
		const newRows = Math.max(1, Math.floor(rows));

		// Skip if dimensions haven't changed — avoids redundant SIGWINCH
		if (session.process.cols === newCols && session.process.rows === newRows) {
			return true;
		}

		session.process.resize(newCols, newRows);
		session.lastActivity = Date.now();
		return true;
	}

	function writeToSession(sessionId: string, data: string, userId?: string): boolean {
		const session = sessions.get(sessionId);
		if (!session) return false;

		if (session.ownerId && (!userId || session.ownerId !== userId)) {
			console.warn(
				`[pty] Ownership check failed: user ${userId || '<empty>'} tried to write to session ${sessionId} owned by ${session.ownerId}`
			);
			return false;
		}

		session.process.write(data);
		session.lastActivity = Date.now();
		return true;
	}

	function hasSession(sessionId: string): boolean {
		return sessions.has(sessionId);
	}

	function isOwner(sessionId: string, userId: string): boolean {
		const session = sessions.get(sessionId);
		if (!session) return false;
		return session.ownerId === userId;
	}

	function listSessions(userId?: string): PtyListResponse {
		let entries = Array.from(sessions.values());

		if (userId) {
			entries = entries.filter((s) => s.ownerId === userId);
		}

		const list = entries.map((s) => ({
			sessionId: s.sessionId,
			createdAt: s.createdAt,
			lastActivity: s.lastActivity,
			bufferBytes: s.bufferBytes,
			connected: s.subscribers > 0,
		}));

		return { sessions: list };
	}

	function setSubscribers(sessionId: string, count: number): void {
		const session = sessions.get(sessionId);
		if (session) {
			session.subscribers = count;
		}
	}

	function cleanupExpiredSessions(): void {
		const now = Date.now();
		for (const [sessionId, session] of sessions.entries()) {
			if (now - session.lastActivity > SESSION_TTL_MS) {
				console.log(`[pty] Session ${sessionId} expired (TTL exceeded)`);
				destroySession(sessionId);
			}
		}
	}

	// Start TTL cleanup interval
	cleanupTimer = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);

	function shutdown(): void {
		console.log('[pty] Shutting down session manager...');

		if (cleanupTimer) {
			clearInterval(cleanupTimer);
			cleanupTimer = null;
		}

		for (const sessionId of sessions.keys()) {
			destroySession(sessionId);
		}
	}

	return {
		createSession,
		destroySession,
		replayBuffer,
		resizeSession,
		writeToSession,
		hasSession,
		isOwner,
		listSessions,
		setSubscribers,
		shutdown,
	};
}
