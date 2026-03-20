/**
 * Terminal proxy — spawns PTY processes that attach to existing tmux panes.
 * Uses the same NATS subject pattern as the pty-service so the xterm.js
 * client code can be reused with minimal changes.
 *
 * Subjects:
 *   os.genie.term.create   → { tmuxPaneId, cols?, rows? } → { sessionId }
 *   os.genie.term.destroy  → { sessionId }
 *   os.genie.term.<id>.data     (service → browser, base64)
 *   os.genie.term.<id>.input    (browser → service, raw text)
 *   os.genie.term.<id>.resize   (browser → service, cols/rows)
 *   os.genie.term.<id>.exit     (service → browser)
 */

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { NatsConnection } from '@nats-io/transport-node';
import * as pty from 'node-pty';

const PREFIX = 'os.genie.term';

interface ProxySession {
	sessionId: string;
	tmuxPaneId: string;
	linkedSessionName: string;
	process: pty.IPty;
	buffer: Buffer[];
	bufferBytes: number;
}

const MAX_BUFFER = 512 * 1024; // 512KB

function addToBuffer(session: ProxySession, data: string): void {
	const chunk = Buffer.from(data, 'utf8');
	session.buffer.push(chunk);
	session.bufferBytes += chunk.length;
	while (session.bufferBytes > MAX_BUFFER && session.buffer.length > 0) {
		const removed = session.buffer.shift();
		if (removed) session.bufferBytes -= removed.length;
	}
}

export function createTerminalProxy(nc: NatsConnection) {
	const sessions = new Map<string, ProxySession>();

	function create(tmuxPaneId: string, cols = 80, rows = 24): string {
		const sessionId = randomUUID();

		// Find the tmux session that owns this pane
		let sessionName: string;
		try {
			sessionName = execSync(`tmux display -t '${tmuxPaneId}' -p '#{session_name}'`, {
				encoding: 'utf-8',
				timeout: 3000,
			}).trim();
		} catch {
			throw new Error(`Cannot find tmux pane ${tmuxPaneId}`);
		}

		// Use new-session -t to create a linked session (independent view of same windows).
		// This way we don't interfere with existing clients' active window/pane.
		// The linked session name is unique per proxy session.
		const linkedName = `_genie_proxy_${sessionId.slice(0, 8)}`;

		const proc = pty.spawn(
			'tmux',
			[
				'new-session',
				'-d',
				'-t',
				sessionName,
				'-s',
				linkedName,
				';',
				'select-window',
				'-t',
				tmuxPaneId,
				';',
				'select-pane',
				'-t',
				tmuxPaneId,
				';',
				'attach-session',
				'-t',
				linkedName,
			],
			{
				name: 'xterm-256color',
				cols,
				rows,
				cwd: process.env.HOME || '/home/genie',
				env: {
					...(process.env as Record<string, string>),
					TERM: 'xterm-256color',
					COLORTERM: 'truecolor',
				},
			}
		);

		const session: ProxySession = {
			sessionId,
			tmuxPaneId,
			linkedSessionName: linkedName,
			process: proc,
			buffer: [],
			bufferBytes: 0,
		};

		// PTY output → buffer + publish to NATS
		proc.onData((data: string) => {
			addToBuffer(session, data);
			nc.publish(
				`${PREFIX}.${sessionId}.data`,
				JSON.stringify({ sessionId, data: Buffer.from(data, 'utf8').toString('base64') })
			);
		});

		// PTY exit → cleanup linked session + notify
		proc.onExit(({ exitCode, signal }) => {
			// Always kill the linked tmux session when PTY dies
			try {
				execSync(`tmux kill-session -t '${linkedName}'`, { timeout: 3000 });
			} catch {
				// already gone
			}
			nc.publish(`${PREFIX}.${sessionId}.exit`, JSON.stringify({ sessionId, code: exitCode, signal }));
			sessions.delete(sessionId);
		});

		sessions.set(sessionId, session);
		return sessionId;
	}

	function destroy(sessionId: string): boolean {
		const session = sessions.get(sessionId);
		if (!session) return false;
		try {
			session.process.kill();
		} catch {
			// already dead
		}
		// Clean up the linked tmux session
		try {
			execSync(`tmux kill-session -t '${session.linkedSessionName}'`, { timeout: 3000 });
		} catch {
			// already gone
		}
		sessions.delete(sessionId);
		return true;
	}

	function write(sessionId: string, data: string): void {
		const session = sessions.get(sessionId);
		if (session) session.process.write(data);
	}

	function resize(sessionId: string, cols: number, rows: number): void {
		const session = sessions.get(sessionId);
		if (session) session.process.resize(Math.max(1, cols), Math.max(1, rows));
	}

	function replay(sessionId: string): void {
		const session = sessions.get(sessionId);
		if (!session) return;
		for (const chunk of session.buffer) {
			nc.publish(`${PREFIX}.${sessionId}.buffer`, JSON.stringify({ sessionId, data: chunk.toString('base64') }));
		}
		nc.publish(`${PREFIX}.${sessionId}.buffer-end`, JSON.stringify({ sessionId }));
	}

	function shutdown(): void {
		for (const sessionId of sessions.keys()) {
			destroy(sessionId);
		}
	}

	return { create, destroy, write, resize, replay, shutdown };
}
