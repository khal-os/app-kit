'use client';

import type { FitAddon } from '@xterm/addon-fit';
import type { WebglAddon } from '@xterm/addon-webgl';
import type { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import { useNats } from '@/lib/hooks/use-nats';
import { SUBJECTS } from '@/lib/subjects';
import { useThemeStore } from '@/stores/theme-store';

/** Resolve a CSS custom property from :root to its computed value. */
function resolveVar(name: string, fallback: string): string {
	if (typeof document === 'undefined') return fallback;
	const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return v || fallback;
}

/** Build xterm color theme from current CSS custom properties. */
function buildTerminalTheme(focused: boolean) {
	const bg = resolveVar('--os-terminal-bg', '#0a0a0a');
	const fg = resolveVar('--os-text-primary', '#e0e0e0');
	const muted = resolveVar('--os-text-muted', '#808080');
	const accent = resolveVar('--os-accent-primary', '#39ff14');
	return {
		background: bg,
		foreground: focused ? fg : muted,
		cursor: focused ? accent : muted,
		cursorAccent: bg,
		selectionBackground: `${accent}33`, // accent with ~20% alpha
		selectionForeground: fg,
		// ANSI palette from CSS vars
		black: resolveVar('--os-ansi-black', '#0a0a0a'),
		red: resolveVar('--os-ansi-red', '#ff5555'),
		green: resolveVar('--os-ansi-green', '#39ff14'),
		yellow: resolveVar('--os-ansi-yellow', '#f1fa8c'),
		blue: resolveVar('--os-ansi-blue', '#6272a4'),
		magenta: resolveVar('--os-ansi-magenta', '#ff79c6'),
		cyan: resolveVar('--os-ansi-cyan', '#8be9fd'),
		white: resolveVar('--os-ansi-white', '#e0e0e0'),
		brightBlack: resolveVar('--os-ansi-bright-black', '#555555'),
		brightRed: resolveVar('--os-ansi-bright-red', '#ff6e6e'),
		brightGreen: resolveVar('--os-ansi-bright-green', '#69ff69'),
		brightYellow: resolveVar('--os-ansi-bright-yellow', '#ffffa5'),
		brightBlue: resolveVar('--os-ansi-bright-blue', '#d6acff'),
		brightMagenta: resolveVar('--os-ansi-bright-magenta', '#ff92df'),
		brightCyan: resolveVar('--os-ansi-bright-cyan', '#a4ffff'),
		brightWhite: resolveVar('--os-ansi-bright-white', '#ffffff'),
	};
}

function decodeBase64(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

interface TerminalPaneProps {
	paneId: string;
	ptySessionId: string | null;
	isFocused: boolean;
	onFocus: () => void;
	onSessionIdChange: (sessionId: string) => void;
	onKeyboardShortcut?: (event: KeyboardEvent) => boolean; // Return false to prevent xterm processing
	onCwdChange?: (cwd: string) => void; // OSC 7 CWD updates
	onLastCommandChange?: (command: string) => void; // Track last command entered
}

/**
 * Single terminal pane (leaf in split tree).
 * Manages one xterm.js instance connected to one PTY session via NATS.
 */
export function TerminalPane({
	paneId,
	ptySessionId,
	isFocused,
	onFocus,
	onSessionIdChange,
	onKeyboardShortcut,
	onCwdChange,
	onLastCommandChange,
}: TerminalPaneProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const terminalRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const webglAddonRef = useRef<WebglAddon | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const unsubsRef = useRef<Array<() => void>>([]);
	const bufferReplayedRef = useRef(false);
	const inputBufferRef = useRef<string>(''); // Track input between Enter keystrokes
	// Dedup + debounce resize to avoid rapid SIGWINCH bursts (each causes bash prompt redraw)
	const lastSentDimsRef = useRef('');
	const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Settle period: suppress all resize→PTY events for 500ms after creation.
	// DOM layout can reflow multiple times as the window manager positions/sizes the
	// window, each triggering fit()→onResize. Without suppression, each gets through
	// the 150ms debounce if reflows are spread across multiple debounce windows,
	// resulting in 2-3 SIGWINCHs → duplicate bash prompts on the same line.
	const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Latest-ref pattern: callbacks in refs prevent the main useEffect from re-running
	// when parent re-renders with new function references
	const onSessionIdChangeRef = useRef(onSessionIdChange);
	onSessionIdChangeRef.current = onSessionIdChange;
	const onKeyboardShortcutRef = useRef(onKeyboardShortcut);
	onKeyboardShortcutRef.current = onKeyboardShortcut;
	const onCwdChangeRef = useRef(onCwdChange);
	onCwdChangeRef.current = onCwdChange;
	const onLastCommandChangeRef = useRef(onLastCommandChange);
	onLastCommandChangeRef.current = onLastCommandChange;
	// Capture initial ptySessionId -- don't re-run effect when our own onSessionIdChange updates it
	const ptySessionIdRef = useRef(ptySessionId);

	const { subscribe, publish, request } = useNats();

	// Setup terminal instance
	useEffect(() => {
		// Local cancelled flag -- each effect invocation gets its own closure.
		// In React StrictMode (mount -> cleanup -> remount), the first invocation's
		// cancelled=true prevents its async work from proceeding, while the second
		// invocation's cancelled=false allows it to run cleanly.
		let cancelled = false;

		if (!containerRef.current) return;

		(async () => {
			const [xtermMod, fitMod] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);

			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
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
				theme: buildTerminalTheme(isFocused),
			});

			terminalRef.current = terminal;

			const fitAddon = new fitMod.FitAddon();
			fitAddonRef.current = fitAddon;
			terminal.loadAddon(fitAddon);

			// Attach custom key event handler
			terminal.attachCustomKeyEventHandler((event) => {
				return onKeyboardShortcutRef.current?.(event) ?? true;
			});

			terminal.open(containerRef.current);

			// Register OSC 7 handler for CWD tracking (shell integration)
			// OSC 7 format: ESC ] 7 ; file://host/path BEL
			terminal.parser.registerOscHandler(7, (data) => {
				try {
					const url = new URL(data);
					if (url.protocol === 'file:' && url.pathname) {
						const cwd = decodeURIComponent(url.pathname);
						onCwdChangeRef.current?.(cwd);
					}
				} catch {
					// Invalid OSC 7 format, ignore
				}
				return true;
			});

			// Fit synchronously so proposeDimensions returns the ACTUAL fitted
			// size. If we defer to rAF, the PTY is created with pre-fit dims
			// and the subsequent fit triggers a resize → SIGWINCH → extra prompt.
			try {
				fitAddon.fit();
			} catch {
				// fit() can throw if container has zero dimensions
			}

			// Get terminal dimensions for PTY creation (after fit — matches reality)
			const dims = fitAddon.proposeDimensions();
			const cols = dims?.cols ?? 80;
			const rows = dims?.rows ?? 24;

			// Guard: StrictMode cleanup may have fired during the sync calls above
			if (cancelled) return;

			// Create or reattach PTY session via NATS
			const response = (await request(SUBJECTS.pty.create(), {
				sessionId: ptySessionIdRef.current || undefined,
				cols,
				rows,
			})) as { sessionId: string; created: boolean };

			if (cancelled) return;

			const resolvedSessionId = response.sessionId;
			sessionIdRef.current = resolvedSessionId;
			// Record dims sent to PTY so we skip redundant resizes (avoids extra SIGWINCH)
			lastSentDimsRef.current = `${cols}x${rows}`;

			// Start settle period: suppress resize→PTY for 500ms while DOM settles.
			// After 500ms, sync final dimensions if they've drifted.
			settleTimerRef.current = setTimeout(() => {
				settleTimerRef.current = null;
				if (cancelled || !sessionIdRef.current) return;
				const settled = fitAddonRef.current?.proposeDimensions();
				if (!settled) return;
				const finalKey = `${settled.cols}x${settled.rows}`;
				if (lastSentDimsRef.current === finalKey) return;
				lastSentDimsRef.current = finalKey;
				publish(SUBJECTS.pty.resize(sessionIdRef.current), {
					sessionId: sessionIdRef.current,
					cols: settled.cols,
					rows: settled.rows,
				});
			}, 500);

			if (response.created) {
				onSessionIdChangeRef.current(resolvedSessionId);
			}

			// Subscribe to data (live output from PTY)
			const unsubData = subscribe(SUBJECTS.pty.data(resolvedSessionId), (msg: unknown) => {
				if (cancelled) return;
				const { data } = msg as { sessionId: string; data: string };
				const bytes = decodeBase64(data);
				terminal.write(bytes);

				// For new sessions, load WebGL after first data
				if (response.created && !bufferReplayedRef.current) {
					bufferReplayedRef.current = true;
					(async () => {
						try {
							const webglMod = await import('@xterm/addon-webgl');
							if (cancelled || !terminalRef.current) return;
							const webglAddon = new webglMod.WebglAddon();
							webglAddon.onContextLoss(() => {
								webglAddon.dispose();
							});
							terminal.loadAddon(webglAddon);
							webglAddonRef.current = webglAddon;
						} catch {
							// WebGL not available
						}
					})();
				}
			});
			unsubsRef.current.push(unsubData);

			// Buffer replay subscriptions — only for reattach.
			// For new sessions, live data arrives via pty.data. Buffer replay is
			// a broadcast (pty.buffer.{sessionId}), so if another tab reattaches
			// and triggers replay, ALL subscribers receive it. Skipping these subs
			// for new sessions prevents the creator from re-displaying already-visible
			// output when other tabs replay.
			if (!response.created) {
				const unsubBuffer = subscribe(SUBJECTS.pty.buffer(resolvedSessionId), (msg: unknown) => {
					if (cancelled) return;
					const { data } = msg as { sessionId: string; data: string };
					const bytes = decodeBase64(data);
					terminal.write(bytes);
				});
				unsubsRef.current.push(unsubBuffer);

				const unsubBufferEnd = subscribe(SUBJECTS.pty.bufferEnd(resolvedSessionId), (msg: unknown) => {
					if (cancelled) return;
					const { error } = (msg as { error?: string }) || {};
					if (error) {
						terminal.write(`\r\n\x1b[31m[Buffer replay denied: ${error}]\x1b[0m\r\n`);
					}
					bufferReplayedRef.current = true;

					// Sync dimensions after replay — debounced to collapse with
					// any ResizeObserver-triggered resizes during DOM settle
					const dimsKey = `${cols}x${rows}`;
					if (lastSentDimsRef.current !== dimsKey) {
						if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
						resizeTimerRef.current = setTimeout(() => {
							if (cancelled || !sessionIdRef.current) return;
							lastSentDimsRef.current = dimsKey;
							publish(SUBJECTS.pty.resize(resolvedSessionId), {
								sessionId: resolvedSessionId,
								cols,
								rows,
							});
						}, 150);
					}

					// Load WebGL addon after buffer replay
					(async () => {
						try {
							const webglMod = await import('@xterm/addon-webgl');
							if (cancelled || !terminalRef.current) return;
							const webglAddon = new webglMod.WebglAddon();
							webglAddon.onContextLoss(() => {
								webglAddon.dispose();
							});
							terminal.loadAddon(webglAddon);
							webglAddonRef.current = webglAddon;
						} catch {
							// WebGL not available
						}
					})();
				});
				unsubsRef.current.push(unsubBufferEnd);

				// Request buffer replay now that subscriptions are in place
				publish(SUBJECTS.pty.replay(resolvedSessionId), {
					sessionId: resolvedSessionId,
				});
			}

			// Subscribe to exit (always — both new and reattached sessions)
			const unsubExit = subscribe(SUBJECTS.pty.exit(resolvedSessionId), (msg: unknown) => {
				if (cancelled) return;
				const { code } = msg as { sessionId: string; code: number; signal?: string };
				terminal.write(`\r\n\x1b[33m[Process exited with code ${code ?? 0}]\x1b[0m\r\n`);
			});
			unsubsRef.current.push(unsubExit);

			// Terminal input -> NATS
			terminal.onData((data) => {
				if (cancelled) return;
				publish(SUBJECTS.pty.input(resolvedSessionId), {
					sessionId: resolvedSessionId,
					data,
				});

				// Track input for last command detection
				if (data === '\r') {
					const command = inputBufferRef.current.trim();
					if (command && onLastCommandChangeRef.current) {
						onLastCommandChangeRef.current(command);
					}
					inputBufferRef.current = '';
				} else if (data === '\x7f' || data === '\x08') {
					inputBufferRef.current = inputBufferRef.current.slice(0, -1);
				} else if (data === '\x03') {
					inputBufferRef.current = '';
				} else if (data === '\x15') {
					inputBufferRef.current = '';
				} else if (data.charCodeAt(0) >= 32) {
					inputBufferRef.current += data;
				}
			});

			terminal.onBinary((data) => {
				if (cancelled) return;
				publish(SUBJECTS.pty.input(resolvedSessionId), {
					sessionId: resolvedSessionId,
					data,
				});
			});

			terminal.onResize(({ cols, rows }) => {
				if (cancelled) return;
				if (!sessionIdRef.current) return;
				// During settle period, skip — the settle timer will sync at the end
				if (settleTimerRef.current) return;
				const dimsKey = `${cols}x${rows}`;
				if (lastSentDimsRef.current === dimsKey) return;
				// Debounce: DOM reflow can trigger several rapid resizes as
				// the window layout settles; each sends SIGWINCH → bash redraws
				// the prompt. Collapse them into a single resize after 150ms.
				if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
				resizeTimerRef.current = setTimeout(() => {
					if (cancelled || !sessionIdRef.current) return;
					lastSentDimsRef.current = dimsKey;
					publish(SUBJECTS.pty.resize(sessionIdRef.current), {
						sessionId: sessionIdRef.current,
						cols,
						rows,
					});
				}, 150);
			});
		})();

		return () => {
			cancelled = true;

			// Unsubscribe all NATS subscriptions
			for (const unsub of unsubsRef.current) {
				unsub();
			}
			unsubsRef.current = [];
			sessionIdRef.current = null;

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
			bufferReplayedRef.current = false;
			lastSentDimsRef.current = '';
			if (resizeTimerRef.current) {
				clearTimeout(resizeTimerRef.current);
				resizeTimerRef.current = null;
			}
			if (settleTimerRef.current) {
				clearTimeout(settleTimerRef.current);
				settleTimerRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paneId, subscribe, publish, request]);

	// Update theme and DOM focus when focus or theme changes
	const concept = useThemeStore((s) => s.concept);
	useEffect(() => {
		const terminal = terminalRef.current;
		if (!terminal) return;

		terminal.options.cursorBlink = false;
		terminal.options.theme = {
			...terminal.options.theme,
			...buildTerminalTheme(isFocused),
		};

		if (isFocused) {
			terminal.focus();
		} else {
			terminal.blur();
		}
	}, [isFocused, concept]);

	// Trigger fit when pane is resized
	useEffect(() => {
		const handleResize = () => {
			if (fitAddonRef.current) {
				requestAnimationFrame(() => {
					try {
						fitAddonRef.current?.fit();
					} catch {
						// ignore
					}
				});
			}
		};

		const observer = new ResizeObserver(handleResize);
		if (containerRef.current) {
			observer.observe(containerRef.current);
		}

		return () => {
			observer.disconnect();
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className="h-full w-full"
			style={{
				padding: '4px',
				opacity: isFocused ? 1 : 0.7,
				transition: 'opacity 0.2s',
			}}
			onClick={onFocus}
		/>
	);
}
