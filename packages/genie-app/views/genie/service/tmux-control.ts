/**
 * tmux client — uses direct exec for queries (reliable) and
 * control mode for pane I/O streaming + event notifications.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as readline from 'node:readline';

function isOctalDigit(ch: string): boolean {
	return ch >= '0' && ch <= '7';
}

function pushUtf8Bytes(bytes: number[], code: number): void {
	if (code <= 0x7f) {
		bytes.push(code);
	} else if (code <= 0x7ff) {
		bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
	} else if (code <= 0xffff) {
		bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
	} else {
		bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
	}
}

/**
 * Decode tmux control mode octal escape format.
 * - \ooo → byte value (3-digit octal)
 * - \\ → literal backslash
 * - All other characters pass through as UTF-8
 */
export function decodeOctalEscapes(input: string): Buffer {
	const bytes: number[] = [];
	let i = 0;
	while (i < input.length) {
		if (input[i] === '\\' && i + 1 < input.length) {
			if (input[i + 1] === '\\') {
				bytes.push(0x5c);
				i += 2;
			} else if (
				i + 3 < input.length &&
				isOctalDigit(input[i + 1]) &&
				isOctalDigit(input[i + 2]) &&
				isOctalDigit(input[i + 3])
			) {
				bytes.push(Number.parseInt(input.substring(i + 1, i + 4), 8));
				i += 4;
			} else {
				bytes.push(input.charCodeAt(i));
				i++;
			}
		} else {
			const code = input.codePointAt(i)!;
			pushUtf8Bytes(bytes, code);
			i += code > 0xffff ? 2 : 1;
		}
	}
	return Buffer.from(bytes);
}

/**
 * A control mode connection to a single tmux session.
 * Emits 'output' events with (paneId, data) for all panes in the session.
 * Emits 'exit' when the control connection ends.
 */
export class ControlSession extends EventEmitter {
	private proc: ChildProcess | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private _connected = false;
	private _detached = false;

	constructor(readonly sessionName: string) {
		super();
		this.connect();
	}

	get connected(): boolean {
		return this._connected;
	}

	private connect(): void {
		if (this._detached) return;

		// Double -C disables echo of input commands
		this.proc = spawn('tmux', ['-CC', 'attach-session', '-t', this.sessionName], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' },
		});

		// Prevent unhandled EPIPE from crashing the process when tmux exits
		this.proc.stdin?.on('error', () => {});

		const rl = readline.createInterface({ input: this.proc.stdout! });

		rl.on('line', (line) => {
			if (!line.startsWith('%')) return;

			if (line.startsWith('%output ')) {
				this.handleOutput(line);
			} else if (line.startsWith('%exit')) {
				this._connected = false;
				this.emit('exit', line.slice(6).trim());
			}
			// Ignore %begin, %end, %error — those are command responses
		});

		this.proc.on('close', (code) => {
			this._connected = false;
			this.proc = null;
			if (!this._detached) {
				// Auto-reconnect after 1 second
				this.reconnectTimer = setTimeout(() => this.connect(), 1000);
			}
			this.emit('close', code);
		});

		this._connected = true;
	}

	private handleOutput(line: string): void {
		// Format: %output %<pane_id> <data>
		// Find pane ID: starts after "%output " and is like "%0", "%42"
		const afterOutput = line.substring(8); // skip "%output "
		const spaceIdx = afterOutput.indexOf(' ');
		if (spaceIdx === -1) return;

		const paneId = afterOutput.substring(0, spaceIdx);
		const rawData = afterOutput.substring(spaceIdx + 1);
		const data = decodeOctalEscapes(rawData);
		this.emit('output', paneId, data);
	}

	/**
	 * Send raw input bytes to a pane using hex mode.
	 * Converts each byte to two-digit hex for send-keys -H.
	 */
	sendKeys(paneId: string, data: string): void {
		if (!this.proc?.stdin?.writable) return;
		const buf = Buffer.from(data, 'utf-8');
		const hex = Array.from(buf)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join(' ');
		this.proc.stdin.write(`send-keys -H -t '${paneId}' ${hex}\n`);
	}

	/**
	 * Resize the control client's view.
	 */
	resizeClient(cols: number, rows: number): void {
		if (!this.proc?.stdin?.writable) return;
		this.proc.stdin.write(`refresh-client -C ${cols},${rows}\n`);
	}

	/**
	 * Detach and clean up the control connection.
	 */
	detach(): void {
		this._detached = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.proc) {
			this.proc.stdin?.end();
			this.proc.kill();
			this.proc = null;
		}
		this._connected = false;
		this.removeAllListeners();
	}
}

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
	 * Attach to an existing tmux session in control mode.
	 * Returns a ControlSession that streams pane output and accepts input.
	 * Creates zero additional tmux sessions.
	 */
	attachSession(sessionName: string): ControlSession {
		return new ControlSession(sessionName);
	}
}
