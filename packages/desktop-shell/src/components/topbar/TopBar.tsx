import { KhalLogo } from '@khal-os/ui';
import { useCallback, useEffect, useState } from 'react';
import { useTabStore } from '../../stores/tab-store';
import { useWindowStore } from '../../stores/window-store';
import { KMenu } from './KMenu';
import { TabPill } from './TabPill';

const TOP_BAR_HEIGHT = 36;

/* -- Close confirmation dialog -- */

interface CloseConfirmDialogProps {
	tabLabel: string;
	runningCount: number;
	onConfirm: () => void;
	onCancel: () => void;
}

function CloseConfirmDialog({ tabLabel, runningCount, onConfirm, onCancel }: CloseConfirmDialogProps) {
	/* Close on Escape */
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onCancel();
			}
		};
		window.addEventListener('keydown', handler, { capture: true });
		return () => window.removeEventListener('keydown', handler, { capture: true });
	}, [onCancel]);

	return (
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center"
			style={{ background: 'rgba(0,0,0,0.4)' }}
			onClick={onCancel}
			onKeyDown={undefined}
		>
			<div
				className="rounded-lg p-5 shadow-xl"
				style={{
					background: 'var(--khal-surface)',
					border: '1px solid var(--khal-taskbar-border)',
					backdropFilter: 'blur(40px) saturate(1.8)',
					WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
					minWidth: 320,
					maxWidth: 400,
				}}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={undefined}
			>
				<h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--khal-text-primary)' }}>
					Close {tabLabel}?
				</h3>
				<p className="mb-4 text-xs" style={{ color: 'var(--khal-text-secondary)' }}>
					{runningCount} running app{runningCount !== 1 ? 's' : ''} will be closed.
				</p>
				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md px-3 py-1.5 text-xs transition-colors"
						style={{
							background: 'rgba(255,255,255,0.08)',
							color: 'var(--khal-text-secondary)',
							border: '1px solid rgba(255,255,255,0.1)',
							cursor: 'default',
						}}
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
						style={{
							background: 'oklch(0.74 0.11 65)',
							color: '#000',
							border: 'none',
							cursor: 'default',
						}}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}

/* -- Tab pills (center section) -- */

function TabPills({ onRequestClose }: { onRequestClose: (tabId: string) => void }) {
	const tabs = useTabStore((s) => s.tabs);
	const activeTabId = useTabStore((s) => s.activeTabId);
	const addTab = useTabStore((s) => s.addTab);
	const isOnly = tabs.length <= 1;

	return (
		<div className="flex items-center justify-center gap-1">
			{tabs.map((tab) => (
				<TabPill
					key={tab.id}
					tab={tab}
					isActive={tab.id === activeTabId}
					isOnly={isOnly}
					onRequestClose={onRequestClose}
				/>
			))}
			<button
				type="button"
				onClick={addTab}
				className="rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
				style={{
					width: 24,
					height: 24,
					fontSize: 14,
					color: 'var(--khal-text-secondary)',
					border: 'none',
					background: 'transparent',
					cursor: 'default',
					flexShrink: 0,
				}}
				aria-label="New desktop tab"
			>
				+
			</button>
		</div>
	);
}

/* -- K icon (right section) -- */

function KIcon({ onClick }: { onClick: () => void }) {
	return (
		<div className="flex items-center justify-center pr-3 pl-2" style={{ flexShrink: 0 }}>
			<button
				type="button"
				onClick={onClick}
				className="flex items-center justify-center rounded-md transition-all duration-200"
				style={{
					color: 'oklch(0.74 0.11 65)',
					cursor: 'default',
					padding: 4,
					background: 'transparent',
					border: 'none',
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.filter = 'drop-shadow(0 0 10px oklch(0.74 0.11 65 / 0.3))';
					e.currentTarget.style.transform = 'scale(1.05)';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.filter = '';
					e.currentTarget.style.transform = '';
				}}
			>
				<svg viewBox="0 0 165 155" fill="none" width={16} height={16} aria-label="K">
						<path
							d="M0 0H27.4425V65.9519H71.7054L122.829 0H155.362L95.3869 76.1317L164.657 154.92H128.805L72.5913 92.2878H27.4425V154.92H0V0Z"
							fill="currentColor"
						/>
					</svg>
			</button>
		</div>
	);
}

/* -- Cmd+Q: short = close app, hold 2s = quit Khal OS -- */

function useCmdQ(setQuitProgress: (p: number | null) => void) {
	useEffect(() => {
		let holdTimer: ReturnType<typeof setTimeout> | null = null;
		let animFrame: ReturnType<typeof requestAnimationFrame> | null = null;
		let startTime = 0;
		let didClose = false;
		const HOLD_DURATION = 2000;

		function startProgressAnimation() {
			startTime = Date.now();
			setQuitProgress(0);
			const animate = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / HOLD_DURATION, 1);
				setQuitProgress(progress);
				if (progress < 1) {
					animFrame = requestAnimationFrame(animate);
				}
			};
			animFrame = requestAnimationFrame(animate);
		}

		function stopProgressAnimation() {
			if (animFrame) {
				cancelAnimationFrame(animFrame);
				animFrame = null;
			}
			setQuitProgress(null);
		}

		const handleDown = (e: KeyboardEvent) => {
			if (e.metaKey && e.key === 'q') {
				e.preventDefault();
				e.stopPropagation();
				if (holdTimer) return;
				didClose = false;

				// Start the hold timer + progress bar
				startProgressAnimation();
				holdTimer = setTimeout(() => {
					// Hold complete -- quit Khal OS with exit animation
					stopProgressAnimation();
					setQuitProgress(1); // Full bar briefly
					setTimeout(() => {
						if (typeof window !== 'undefined' && (window as any).__TAURI__) {
							// biome-ignore lint: dynamic Tauri IPC
							(window as any).__TAURI__?.core?.invoke('quit_app');
						}
					}, 300); // Brief pause to show full bar
				}, HOLD_DURATION);
			}
		};

		const handleUp = (e: KeyboardEvent) => {
			if (e.key === 'q' || e.key === 'Meta') {
				if (holdTimer) {
					clearTimeout(holdTimer);
					holdTimer = null;
					stopProgressAnimation();

					// Short press -- close the focused app window
					if (!didClose) {
						didClose = true;
						const ws = useWindowStore.getState();
						const topWindow = ws.getTopmostWindow();
						if (topWindow) {
							ws.closeWindow(topWindow.id);
						}
					}
				}
			}
		};

		window.addEventListener('keydown', handleDown, { capture: true });
		window.addEventListener('keyup', handleUp, { capture: true });
		return () => {
			window.removeEventListener('keydown', handleDown, { capture: true });
			window.removeEventListener('keyup', handleUp, { capture: true });
			if (holdTimer) clearTimeout(holdTimer);
			stopProgressAnimation();
		};
	}, [setQuitProgress]);
}

/* -- Keyboard shortcuts hook -- */

function useDesktopTabKeybinds(requestCloseActiveTab: () => void) {
	const addTab = useTabStore((s) => s.addTab);
	const tabs = useTabStore((s) => s.tabs);
	const activeTabId = useTabStore((s) => s.activeTabId);
	const setActiveTab = useTabStore((s) => s.setActiveTab);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Ctrl+Tab / Ctrl+Shift+Tab -- switch desktop tabs
			if (e.ctrlKey && e.key === 'Tab') {
				e.preventDefault();
				e.stopPropagation();
				const currentIdx = tabs.findIndex((t) => t.id === activeTabId);
				if (currentIdx === -1) return;
				const nextIdx = e.shiftKey ? (currentIdx - 1 + tabs.length) % tabs.length : (currentIdx + 1) % tabs.length;
				setActiveTab(tabs[nextIdx].id);
				return;
			}

			// Cmd+T -- new desktop tab, Cmd+W -- close active tab
			if (!e.metaKey) return;

			if (e.key === 't') {
				e.preventDefault();
				e.stopPropagation();
				addTab();
			} else if (e.key === 'w') {
				e.preventDefault();
				e.stopPropagation();
				requestCloseActiveTab();
			}
		};

		window.addEventListener('keydown', handler, { capture: true });
		return () => window.removeEventListener('keydown', handler, { capture: true });
	}, [addTab, requestCloseActiveTab, tabs, activeTabId, setActiveTab]);
}

/* -- Main TopBar -- */

export const TOPBAR_HEIGHT = TOP_BAR_HEIGHT;

export function TopBar() {
	/* K menu state */
	const [kMenuOpen, setKMenuOpen] = useState(false);
	const toggleKMenu = useCallback(() => setKMenuOpen((prev) => !prev), []);
	const closeKMenu = useCallback(() => setKMenuOpen(false), []);

	/* Cmd+Q: short = close app, hold 2s = quit */
	const [quitProgress, setQuitProgress] = useState<number | null>(null);
	useCmdQ(setQuitProgress);

	/* Close-confirmation state */
	const [confirmClose, setConfirmClose] = useState<{ tabId: string; tabLabel: string; runningCount: number } | null>(
		null
	);

	const tabs = useTabStore((s) => s.tabs);
	const activeTabId = useTabStore((s) => s.activeTabId);
	const removeTab = useTabStore((s) => s.removeTab);

	/** Check whether a tab has running apps and either close immediately or show confirmation. */
	const requestClose = useCallback(
		(tabId: string) => {
			// Can't close last tab
			if (tabs.length <= 1) return;

			const workspaceWindows = useWindowStore.getState().windowsByWorkspace[tabId] ?? [];
			const runningCount = workspaceWindows.length;

			if (runningCount > 0) {
				const tab = tabs.find((t) => t.id === tabId);
				setConfirmClose({ tabId, tabLabel: tab?.label ?? 'this tab', runningCount });
			} else {
				removeTab(tabId);
			}
		},
		[tabs, removeTab]
	);

	/** Request close on the active tab (used by Cmd+W). */
	const requestCloseActiveTab = useCallback(() => {
		requestClose(activeTabId);
	}, [activeTabId, requestClose]);

	/* Register Cmd+T / Cmd+W */
	useDesktopTabKeybinds(requestCloseActiveTab);

	const handleConfirmClose = useCallback(() => {
		if (confirmClose) {
			removeTab(confirmClose.tabId);
			setConfirmClose(null);
		}
	}, [confirmClose, removeTab]);

	const handleCancelClose = useCallback(() => {
		setConfirmClose(null);
	}, []);

	return (
		<>
			<header
				className="fixed top-0 left-0 right-0 flex items-center"
				style={{
					height: TOP_BAR_HEIGHT,
					zIndex: 9500,
					background: 'var(--khal-taskbar-bg)',
					backdropFilter: 'blur(40px) saturate(1.8)',
					WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
					borderBottom: '1px solid var(--khal-taskbar-border)',
				}}
				data-tauri-drag-region=""
			>
				{/* Left: tab pills (padded for native traffic lights) */}
				<div className="flex-1 flex items-center justify-start overflow-hidden" style={{ paddingLeft: 80 }}>
					<TabPills onRequestClose={requestClose} />
				</div>

				{/* Right: app name + K icon */}
				<div className="flex items-center gap-1" style={{ minWidth: 120, justifyContent: 'flex-end' }}>
					<span
						className="text-xs font-medium select-none"
						style={{ color: 'var(--khal-text-secondary)', letterSpacing: '0.02em' }}
					>
						Khal OS
					</span>
					<KIcon onClick={toggleKMenu} />
				</div>
			</header>

			{/* K menu dropdown */}
			<KMenu open={kMenuOpen} onClose={closeKMenu} />

			{/* Cmd+Q hold-to-quit overlay */}
			{quitProgress !== null && (
				<div
					className="fixed inset-0 z-[10000] flex flex-col items-center justify-center"
					style={{
						background: `rgba(13, 13, 20, ${0.4 + quitProgress * 0.5})`,
						transition: 'background 0.1s',
					}}
				>
					<div
						className="flex flex-col items-center gap-6 rounded-2xl px-12 py-10 shadow-2xl"
						style={{
							background: 'var(--khal-surface)',
							border: '1px solid var(--khal-taskbar-border)',
							backdropFilter: 'blur(60px) saturate(2)',
							WebkitBackdropFilter: 'blur(60px) saturate(2)',
							minWidth: 340,
						}}
					>
						<KhalLogo size={32} />
						<span className="text-sm font-medium" style={{ color: 'var(--khal-text-primary)' }}>
							Hold Cmd+Q to quit Khal OS
						</span>
						<div
							className="w-full rounded-full overflow-hidden"
							style={{ height: 4, background: 'rgba(255,255,255,0.08)', width: 260 }}
						>
							<div
								className="h-full rounded-full"
								style={{
									width: `${Math.round(quitProgress * 100)}%`,
									background: 'oklch(0.74 0.11 65)',
									boxShadow: '0 0 12px oklch(0.74 0.11 65 / 0.5)',
								}}
							/>
						</div>
						<span className="text-xs" style={{ color: 'var(--khal-text-secondary)' }}>
							Release to cancel
						</span>
					</div>
				</div>
			)}

			{/* Close confirmation dialog */}
			{confirmClose && (
				<CloseConfirmDialog
					tabLabel={confirmClose.tabLabel}
					runningCount={confirmClose.runningCount}
					onConfirm={handleConfirmClose}
					onCancel={handleCancelClose}
				/>
			)}
		</>
	);
}
