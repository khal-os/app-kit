'use client';

// NOTE: This component connects to tmux panes via control mode (server-side). It does NOT create proxy sessions. NEVER introduce node-pty, _genie_proxy_*, or linked tmux sessions here.

import { getNatsClient } from '@khal-os/sdk/app';
import type { FitAddon } from '@xterm/addon-fit';
import type { WebglAddon } from '@xterm/addon-webgl';
import type { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import { SUBJECTS } from '../../../lib/subjects';

function decodeBase64(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

interface XTermPaneProps {
	tmuxPaneId: string;
	onDisconnect?: () => void;
}

/**
 * XTermPane connected to a tmux pane via terminal proxy.
 *
 * Uses a "create guard" ref to prevent StrictMode double-mount from
 * creating duplicate proxy sessions. The proxy session ID is stored
 * in a ref and destroyed synchronously via NATS request on cleanup.
 */
export function XTermPane({ tmuxPaneId, onDisconnect }: XTermPaneProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const terminalRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const webglAddonRef = useRef<WebglAddon | null>(null);
	const unsubsRef = useRef<Array<() => void>>([]);
	const lastSentDimsRef = useRef('');
	const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onDisconnectRef = useRef(onDisconnect);
	onDisconnectRef.current = onDisconnect;

	// Guard: track the proxy session across StrictMode mount cycles.
	// This ref persists across unmount→remount and prevents double creation.
	const proxySessionRef = useRef<string | null>(null);
	const createInFlightRef = useRef(false);

	useEffect(() => {
		let cancelled = false;
		if (!containerRef.current) return;

		const client = getNatsClient();

		(async () => {
			const [xtermMod, fitMod] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);

			// @ts-ignore — CSS import required for xterm rendering
			await import('@xterm/xterm/css/xterm.css');

			if (cancelled || !containerRef.current) return;

			const terminal = new xtermMod.Terminal({
				cursorBlink: false,
				cursorStyle: 'block',
				fontSize: 14,
				fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
				lineHeight: 1.2,
				scrollback: 5000,
				allowProposedApi: true,
				theme: {
					background: '#0a0a0a',
					foreground: '#e0e0e0',
					cursor: '#39ff14',
					cursorAccent: '#0a0a0a',
					selectionBackground: '#39ff1433',
					black: '#0a0a0a',
					red: '#ff5555',
					green: '#39ff14',
					yellow: '#f1fa8c',
					blue: '#6272a4',
					magenta: '#ff79c6',
					cyan: '#8be9fd',
					white: '#e0e0e0',
					brightBlack: '#555555',
					brightRed: '#ff6e6e',
					brightGreen: '#69ff69',
					brightYellow: '#ffffa5',
					brightBlue: '#d6acff',
					brightMagenta: '#ff92df',
					brightCyan: '#a4ffff',
					brightWhite: '#ffffff',
				},
			});

			terminalRef.current = terminal;

			const fitAddon = new fitMod.FitAddon();
			fitAddonRef.current = fitAddon;
			terminal.loadAddon(fitAddon);
			terminal.open(containerRef.current);

			try {
				fitAddon.fit();
			} catch {
				// zero dimensions
			}

			const dims = fitAddon.proposeDimensions();
			const cols = dims?.cols ?? 80;
			const rows = dims?.rows ?? 24;

			if (cancelled) return;

			// Prevent double creation (StrictMode guard)
			if (createInFlightRef.current || proxySessionRef.current) {
				// Already creating or already created — reuse existing session
				const existingId = proxySessionRef.current;
				if (existingId) {
					wireUpTerminal(terminal, client, existingId, cancelled, cols, rows);
				}
				return;
			}

			createInFlightRef.current = true;

			let sessionId: string;
			try {
				const resp = (await client.request(SUBJECTS.term.create(), { tmuxPaneId, cols, rows }, 10000)) as {
					sessionId?: string;
					error?: string;
				};
				if (!resp.sessionId) {
					terminal.writeln(`\r\n\x1b[31mFailed: ${resp.error || 'no session'}\x1b[0m`);
					createInFlightRef.current = false;
					return;
				}
				sessionId = resp.sessionId;
			} catch (err) {
				terminal.writeln(`\r\n\x1b[31mFailed to connect: ${err}\x1b[0m`);
				createInFlightRef.current = false;
				return;
			}

			createInFlightRef.current = false;

			// If unmounted while awaiting, destroy immediately
			if (cancelled) {
				client.request(SUBJECTS.term.destroy(), { sessionId }, 5000).catch(() => {});
				return;
			}

			proxySessionRef.current = sessionId;
			wireUpTerminal(terminal, client, sessionId, cancelled, cols, rows);
		})();

		function wireUpTerminal(
			terminal: Terminal,
			client: ReturnType<typeof getNatsClient>,
			sessionId: string,
			isCancelled: boolean,
			cols: number,
			rows: number
		) {
			lastSentDimsRef.current = `${cols}x${rows}`;

			settleTimerRef.current = setTimeout(() => {
				settleTimerRef.current = null;
				if (isCancelled || !proxySessionRef.current) return;
				const settled = fitAddonRef.current?.proposeDimensions();
				if (!settled) return;
				const finalKey = `${settled.cols}x${settled.rows}`;
				if (lastSentDimsRef.current === finalKey) return;
				lastSentDimsRef.current = finalKey;
				client.publish(SUBJECTS.term.resize(proxySessionRef.current), { cols: settled.cols, rows: settled.rows });
			}, 500);

			const unsubData = client.subscribe(SUBJECTS.term.data(sessionId), (msg: unknown) => {
				if (isCancelled) return;
				const { data } = msg as { data: string };
				if (data) terminal.write(decodeBase64(data));
			});
			unsubsRef.current.push(unsubData);

			const unsubBuffer = client.subscribe(SUBJECTS.term.buffer(sessionId), (msg: unknown) => {
				if (isCancelled) return;
				const { data } = msg as { data: string };
				if (data) terminal.write(decodeBase64(data));
			});
			unsubsRef.current.push(unsubBuffer);

			const unsubBufferEnd = client.subscribe(SUBJECTS.term.bufferEnd(sessionId), () => {
				if (isCancelled) return;
				(async () => {
					try {
						const webglMod = await import('@xterm/addon-webgl');
						if (isCancelled || !terminalRef.current) return;
						const addon = new webglMod.WebglAddon();
						addon.onContextLoss(() => addon.dispose());
						terminal.loadAddon(addon);
						webglAddonRef.current = addon;
					} catch {
						// WebGL unavailable
					}
				})();
			});
			unsubsRef.current.push(unsubBufferEnd);

			client.publish(SUBJECTS.term.replay(sessionId), { sessionId });

			const unsubExit = client.subscribe(SUBJECTS.term.exit(sessionId), () => {
				if (isCancelled) return;
				terminal.writeln('\r\n\x1b[33m[session ended]\x1b[0m');
				proxySessionRef.current = null;
				onDisconnectRef.current?.();
			});
			unsubsRef.current.push(unsubExit);

			terminal.onData((data) => {
				if (isCancelled || !proxySessionRef.current) return;
				client.publish(SUBJECTS.term.input(proxySessionRef.current), { data });
			});

			terminal.onBinary((data) => {
				if (isCancelled || !proxySessionRef.current) return;
				client.publish(SUBJECTS.term.input(proxySessionRef.current), { data });
			});

			terminal.onResize(({ cols: c, rows: r }) => {
				if (isCancelled || !proxySessionRef.current) return;
				if (settleTimerRef.current) return;
				const dimsKey = `${c}x${r}`;
				if (lastSentDimsRef.current === dimsKey) return;
				if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
				resizeTimerRef.current = setTimeout(() => {
					if (isCancelled || !proxySessionRef.current) return;
					lastSentDimsRef.current = dimsKey;
					client.publish(SUBJECTS.term.resize(proxySessionRef.current), { cols: c, rows: r });
				}, 150);
			});
		}

		return () => {
			cancelled = true;
			for (const unsub of unsubsRef.current) unsub();
			unsubsRef.current = [];

			if (webglAddonRef.current) {
				try {
					webglAddonRef.current.dispose();
				} catch {
					// ignore
				}
				webglAddonRef.current = null;
			}
			if (terminalRef.current) {
				terminalRef.current.dispose();
				terminalRef.current = null;
			}
			fitAddonRef.current = null;
			lastSentDimsRef.current = '';
			if (resizeTimerRef.current) {
				clearTimeout(resizeTimerRef.current);
				resizeTimerRef.current = null;
			}
			if (settleTimerRef.current) {
				clearTimeout(settleTimerRef.current);
				settleTimerRef.current = null;
			}
			// NOTE: don't destroy proxySessionRef here — StrictMode will remount
			// and reuse it. Destroy only happens when the component truly unmounts
			// (selectedPaneId changes or user closes), handled by the tmuxPaneId cleanup below.
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tmuxPaneId]);

	// Destroy proxy session when tmuxPaneId changes or component fully unmounts
	useEffect(() => {
		return () => {
			const sessionId = proxySessionRef.current;
			if (sessionId) {
				proxySessionRef.current = null;
				createInFlightRef.current = false;
				const client = getNatsClient();
				client.request(SUBJECTS.term.destroy(), { sessionId }, 5000).catch(() => {});
			}
		};
	}, [tmuxPaneId]);

	// ResizeObserver
	useEffect(() => {
		const observer = new ResizeObserver(() => {
			requestAnimationFrame(() => {
				try {
					fitAddonRef.current?.fit();
				} catch {
					// ignore
				}
			});
		});
		if (containerRef.current) observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	return <div ref={containerRef} className="h-full w-full" style={{ padding: '4px' }} />;
}
