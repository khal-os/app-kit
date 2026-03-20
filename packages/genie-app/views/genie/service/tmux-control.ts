/**
 * tmux client — uses direct exec for queries (reliable) and
 * optional control mode for event streaming.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as readline from 'node:readline';

export interface TmuxSession {
	id: string;
	name: string;
	windows: number;
	attached: number;
	created: number;
}

export interface TmuxWindow {
	id: string;
	name: string;
	panes: number;
	active: boolean;
	sessionId: string;
	width: number;
	height: number;
}

export interface TmuxPane {
	id: string;
	windowId: string;
	active: boolean;
	pid: number;
	command: string;
	title: string;
	left: number;
	top: number;
	width: number;
	height: number;
	dead: boolean;
}

/**
 * Run a tmux command and return stdout.
 */
function tmuxExec(args: string): string {
	return execSync(`tmux ${args}`, { encoding: 'utf-8', timeout: 5000 }).trim();
}

export class TmuxControl extends EventEmitter {
	private controlProc: ChildProcess | null = null;

	/**
	 * List all tmux sessions.
	 */
	listSessions(): TmuxSession[] {
		try {
			const output = tmuxExec(
				"list-sessions -F '#{session_id}|#{session_name}|#{session_windows}|#{session_attached}|#{session_created}'"
			);
			if (!output) return [];
			return output.split('\n').map((line) => {
				const [id, name, windows, attached, created] = line.split('|');
				return {
					id,
					name,
					windows: Number.parseInt(windows, 10),
					attached: Number.parseInt(attached, 10),
					created: Number.parseInt(created, 10),
				};
			});
		} catch {
			return [];
		}
	}

	/**
	 * List all windows across all sessions.
	 */
	listWindows(): TmuxWindow[] {
		try {
			const output = tmuxExec(
				"list-windows -a -F '#{window_id}|#{window_name}|#{window_panes}|#{window_active}|#{session_id}|#{window_width}|#{window_height}'"
			);
			if (!output) return [];
			return output.split('\n').map((line) => {
				const [id, name, panes, active, sessionId, width, height] = line.split('|');
				return {
					id,
					name,
					panes: Number.parseInt(panes, 10),
					active: active === '1',
					sessionId,
					width: Number.parseInt(width, 10),
					height: Number.parseInt(height, 10),
				};
			});
		} catch {
			return [];
		}
	}

	/**
	 * List all panes across all sessions.
	 */
	listPanes(): TmuxPane[] {
		try {
			const output = tmuxExec(
				"list-panes -a -F '#{pane_id}|#{window_id}|#{pane_active}|#{pane_pid}|#{pane_current_command}|#{pane_title}|#{pane_left}|#{pane_top}|#{pane_width}|#{pane_height}|#{pane_dead}'"
			);
			if (!output) return [];
			return output.split('\n').map((line) => {
				const [id, windowId, active, pid, command, title, left, top, width, height, dead] = line.split('|');
				return {
					id,
					windowId,
					active: active === '1',
					pid: Number.parseInt(pid, 10),
					command,
					title,
					left: Number.parseInt(left, 10),
					top: Number.parseInt(top, 10),
					width: Number.parseInt(width, 10),
					height: Number.parseInt(height, 10),
					dead: dead === '1',
				};
			});
		} catch {
			return [];
		}
	}

	/**
	 * Capture pane content (snapshot).
	 */
	capturePane(paneId: string, lines = 50): string {
		try {
			return tmuxExec(`capture-pane -t '${paneId}' -p -S ${-lines} -J`);
		} catch {
			return '';
		}
	}

	/**
	 * Send keys to a pane.
	 */
	sendKeys(paneId: string, keys: string): void {
		const escaped = keys.replace(/'/g, "'\\''");
		tmuxExec(`send-keys -t '${paneId}' -l '${escaped}'`);
		tmuxExec(`send-keys -t '${paneId}' Enter`);
	}

	/**
	 * Start control mode for event streaming (optional).
	 * Emits 'notification' events for structural changes.
	 */
	startEventStream(): void {
		if (this.controlProc) return;

		this.controlProc = spawn('tmux', ['-C', 'new-session', '-d', '-s', '_genie_events'], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' },
		});

		const rl = readline.createInterface({ input: this.controlProc.stdout! });

		rl.on('line', (line) => {
			if (!line.startsWith('%')) return;
			if (line.startsWith('%begin') || line.startsWith('%end') || line.startsWith('%error')) return;

			const parts = line.split(' ');
			const type = parts[0].slice(1);
			const args = parts.slice(1);
			this.emit(type, ...args);
		});

		this.controlProc.on('close', () => {
			this.controlProc = null;
			// Clean up the ephemeral session
			try {
				tmuxExec('kill-session -t _genie_events');
			} catch {
				// already gone
			}
		});
	}

	/**
	 * Disconnect event stream.
	 */
	disconnect(): void {
		if (this.controlProc) {
			this.controlProc.stdin?.end();
			this.controlProc.kill();
			this.controlProc = null;
		}
		try {
			tmuxExec('kill-session -t _genie_events');
		} catch {
			// already gone
		}
	}
}
