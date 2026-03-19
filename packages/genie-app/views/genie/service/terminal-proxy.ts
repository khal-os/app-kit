/**
 * Terminal proxy — uses tmux control mode to stream pane I/O.
 * One control mode connection per tmux session, multiplexing all pane output.
 * Zero linked sessions, zero PTY processes.
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
import type { ControlSession, TmuxControl } from './tmux-control';

const PREFIX = 'os.genie.term';

interface ProxySession {
	sessionId: string;
	tmuxPaneId: string;
	tmuxSessionName: string;
	controlSession: ControlSession;
	outputHandler: (paneId: string, data: Buffer) => void;
}

interface ControlEntry {
	controlSession: ControlSession;
	refCount: number;
}

export function createTerminalProxy(nc: NatsConnection, tmux: TmuxControl) {
	const sessions = new Map<string, ProxySession>();
	const controlSessions = new Map<string, ControlEntry>();

	function getOrCreateControl(sessionName: string): ControlSession {
		let entry = controlSessions.get(sessionName);
		if (entry) {
			entry.refCount++;
			return entry.controlSession;
		}

		const cs = tmux.attachSession(sessionName);
		entry = { controlSession: cs, refCount: 1 };
		controlSessions.set(sessionName, entry);

		// If the control session exits, notify all proxy sessions using it
		cs.on('exit', () => {
			for (const [sid, session] of sessions) {
				if (session.tmuxSessionName === sessionName) {
					nc.publish(`${PREFIX}.${sid}.exit`, JSON.stringify({ sessionId: sid, code: 0 }));
				}
			}
		});

		return cs;
	}

	function releaseControl(sessionName: string): void {
		const entry = controlSessions.get(sessionName);
		if (!entry) return;
		entry.refCount--;
		if (entry.refCount <= 0) {
			entry.controlSession.detach();
			controlSessions.delete(sessionName);
		}
	}

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

		const controlSession = getOrCreateControl(sessionName);

		// Register output listener filtered to this pane
		const outputHandler = (paneId: string, data: Buffer) => {
			if (paneId !== tmuxPaneId) return;
			nc.publish(`${PREFIX}.${sessionId}.data`, JSON.stringify({ sessionId, data: data.toString('base64') }));
		};
		controlSession.on('output', outputHandler);

		const session: ProxySession = {
			sessionId,
			tmuxPaneId,
			tmuxSessionName: sessionName,
			controlSession,
			outputHandler,
		};
		sessions.set(sessionId, session);

		// Set initial size
		controlSession.resizeClient(cols, rows);

		// Initial buffer fill via capture-pane
		try {
			const content = tmux.capturePane(tmuxPaneId);
			if (content) {
				nc.publish(
					`${PREFIX}.${sessionId}.buffer`,
					JSON.stringify({ sessionId, data: Buffer.from(content, 'utf-8').toString('base64') })
				);
				nc.publish(`${PREFIX}.${sessionId}.buffer-end`, JSON.stringify({ sessionId }));
			}
		} catch {
			// capture errors are non-fatal
		}

		return sessionId;
	}

	function destroy(sessionId: string): boolean {
		const session = sessions.get(sessionId);
		if (!session) return false;

		// Unregister the output listener
		session.controlSession.removeListener('output', session.outputHandler);
		sessions.delete(sessionId);

		// Release control session (detaches when refcount hits zero)
		releaseControl(session.tmuxSessionName);

		return true;
	}

	function write(sessionId: string, data: string): void {
		const session = sessions.get(sessionId);
		if (session) {
			session.controlSession.sendKeys(session.tmuxPaneId, data);
		}
	}

	function resize(sessionId: string, cols: number, rows: number): void {
		const session = sessions.get(sessionId);
		if (session) {
			session.controlSession.resizeClient(Math.max(1, cols), Math.max(1, rows));
		}
	}

	function replay(sessionId: string): void {
		const session = sessions.get(sessionId);
		if (!session) return;

		try {
			const content = tmux.capturePane(session.tmuxPaneId);
			if (content) {
				nc.publish(
					`${PREFIX}.${sessionId}.buffer`,
					JSON.stringify({ sessionId, data: Buffer.from(content, 'utf-8').toString('base64') })
				);
			}
		} catch {
			// capture errors are non-fatal
		}
		nc.publish(`${PREFIX}.${sessionId}.buffer-end`, JSON.stringify({ sessionId }));
	}

	function shutdown(): void {
		// Destroy all proxy sessions
		for (const sessionId of [...sessions.keys()]) {
			destroy(sessionId);
		}
		// Detach any remaining control sessions
		for (const [, entry] of controlSessions) {
			entry.controlSession.detach();
		}
		controlSessions.clear();
	}

	return { create, destroy, write, resize, replay, shutdown };
}
