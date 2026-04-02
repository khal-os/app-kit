import { SUBJECTS, useKhalAuth, useNats } from '@khal-os/sdk/app';
import { Monitor, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWindowStore } from '../../stores/window-store';

interface Session {
	sessionId: string;
	createdAt: number;
	lastActivity: number;
	bufferBytes: number;
	connected: boolean;
}

/**
 * Orphan Session Detection Toast
 *
 * Detects server-side PTY sessions that have no matching terminal window.
 * Offers Chrome-style restore functionality.
 */
export function OrphanSessionToast() {
	const [orphanSessions, setOrphanSessions] = useState<Session[]>([]);
	const [visible, setVisible] = useState(false);
	const [loading, setLoading] = useState(false);

	const getWindows = useWindowStore((s) => s.getWindows);
	const openWindow = useWindowStore((s) => s.openWindow);
	const { connected, request, publish, orgId } = useNats();
	const auth = useKhalAuth();
	const userId = auth?.userId ?? '';

	// On mount + NATS connect: detect orphans
	useEffect(() => {
		if (!connected || !orgId) return;
		detectOrphans();
	}, [connected, orgId, userId]);

	async function detectOrphans() {
		try {
			const response = (await request(SUBJECTS.pty.list(orgId), { userId: userId || undefined })) as {
				sessions: Session[];
			};
			const sessions = response.sessions;

			const windows = getWindows();
			const terminalWindows = windows.filter((w) => w.appId === 'terminal');

			const activeSessions = new Set<string>();

			for (const w of terminalWindows) {
				if (w.meta?.ptySessionId && typeof w.meta.ptySessionId === 'string') {
					activeSessions.add(w.meta.ptySessionId);
				}

				if (w.meta?.tabs && Array.isArray(w.meta.tabs)) {
					type SplitNode = { type: string; ptySessionId?: string; children?: SplitNode[] };
					type Tab = { ptySessionId?: string; splitTree?: SplitNode };

					const collectFromTree = (node: SplitNode): void => {
						if (!node) return;
						if (node.type === 'leaf' && node.ptySessionId) {
							activeSessions.add(node.ptySessionId);
						} else if (node.type === 'branch' && Array.isArray(node.children)) {
							for (const child of node.children) {
								collectFromTree(child);
							}
						}
					};

					for (const tab of w.meta.tabs as Tab[]) {
						if (tab.ptySessionId && typeof tab.ptySessionId === 'string') {
							activeSessions.add(tab.ptySessionId);
						}
						if (tab.splitTree) {
							collectFromTree(tab.splitTree);
						}
					}
				}
			}

			const orphans = sessions.filter((s) => !activeSessions.has(s.sessionId));

			if (orphans.length > 0) {
				setOrphanSessions(orphans);
				setVisible(true);
			}
		} catch {
			// PTY server may not be running -- silently ignore connection failures
		}
	}

	async function handleRestoreAll() {
		setLoading(true);
		try {
			if (orphanSessions.length === 1) {
				openWindow({
					title: 'Terminal',
					appId: 'terminal',
					width: 720,
					height: 480,
					meta: {
						tabs: [
							{
								id: `tab-${orphanSessions[0].sessionId}`,
								ptySessionId: orphanSessions[0].sessionId,
								title: 'bash',
								cwd: null,
								lastCommand: null,
								focused: true,
								splitTree: {
									type: 'leaf',
									id: `pane-${orphanSessions[0].sessionId}`,
									ptySessionId: orphanSessions[0].sessionId,
									cwd: null,
									lastCommand: null,
								},
								focusedPaneId: `pane-${orphanSessions[0].sessionId}`,
							},
						],
						activeTabId: `tab-${orphanSessions[0].sessionId}`,
					},
				});
			} else {
				const tabs = orphanSessions.map((session, idx) => ({
					id: `tab-${session.sessionId}`,
					ptySessionId: session.sessionId,
					title: 'bash',
					cwd: null,
					lastCommand: null,
					focused: idx === 0,
					splitTree: {
						type: 'leaf',
						id: `pane-${session.sessionId}`,
						ptySessionId: session.sessionId,
						cwd: null,
						lastCommand: null,
					},
					focusedPaneId: `pane-${session.sessionId}`,
				}));

				openWindow({
					title: 'Terminal',
					appId: 'terminal',
					width: 720,
					height: 480,
					meta: {
						tabs,
						activeTabId: tabs[0].id,
					},
				});
			}
			setVisible(false);
		} finally {
			setLoading(false);
		}
	}

	async function handleKillAll() {
		setLoading(true);
		try {
			for (const session of orphanSessions) {
				publish(SUBJECTS.pty.destroy(orgId), { sessionId: session.sessionId, userId: userId || undefined });
			}
			setVisible(false);
		} finally {
			setLoading(false);
		}
	}

	function handleDismiss() {
		setVisible(false);
	}

	if (!visible || orphanSessions.length === 0) {
		return null;
	}

	const count = orphanSessions.length;
	const message =
		count === 1
			? '1 terminal session still running from a previous visit'
			: `${count} terminal sessions still running from a previous visit`;

	return (
		<div
			className="fixed bottom-20 left-1/2 z-[9600] -translate-x-1/2"
			role="alert"
			aria-live="polite"
			aria-label="Orphaned terminal sessions"
		>
			<div
				className="flex min-w-[400px] items-center gap-3 rounded-lg p-4 backdrop-blur-xl"
				style={{
					animation: 'notif-slide-in 300ms ease-out',
					background: 'var(--khal-surface-overlay)',
					border: '1px solid var(--khal-border-default)',
					boxShadow: 'var(--khal-shadow-xl)',
				}}
			>
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
					style={{ background: 'var(--khal-accent-subtle)' }}
				>
					<Monitor size={20} style={{ color: 'var(--khal-accent-primary)' }} />
				</div>

				<div className="min-w-0 flex-1">
					<p className="text-label-14" style={{ color: 'var(--khal-text-primary)' }}>
						{message}
					</p>
				</div>

				<div className="flex shrink-0 gap-2">
					<button
						className="rounded-md px-3 py-1.5 text-label-13 transition-colors disabled:opacity-50"
						style={{
							background: 'var(--khal-accent-primary)',
							color: 'var(--khal-text-inverse)',
						}}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLElement).style.background = 'var(--khal-accent-hover)';
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLElement).style.background = 'var(--khal-accent-primary)';
						}}
						onClick={handleRestoreAll}
						disabled={loading}
					>
						Restore All
					</button>
					<button
						className="rounded-md bg-red-500/10 px-3 py-1.5 text-label-13 text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
						onClick={handleKillAll}
						disabled={loading}
					>
						Kill All
					</button>
					<button
						className="rounded-md px-3 py-1.5 text-label-13 transition-colors disabled:opacity-50"
						style={{ color: 'var(--khal-text-secondary)' }}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLElement).style.background = 'var(--khal-accent-subtle)';
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLElement).style.background = '';
						}}
						onClick={handleDismiss}
						disabled={loading}
					>
						Dismiss
					</button>
				</div>

				<button
					className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors"
					style={{ color: 'var(--khal-text-muted)' }}
					onMouseEnter={(e) => {
						(e.currentTarget as HTMLElement).style.background = 'var(--khal-accent-subtle)';
						(e.currentTarget as HTMLElement).style.color = 'var(--khal-text-primary)';
					}}
					onMouseLeave={(e) => {
						(e.currentTarget as HTMLElement).style.background = '';
						(e.currentTarget as HTMLElement).style.color = 'var(--khal-text-muted)';
					}}
					onClick={handleDismiss}
					disabled={loading}
					aria-label="Dismiss notification"
				>
					<X size={14} />
				</button>
			</div>
		</div>
	);
}
