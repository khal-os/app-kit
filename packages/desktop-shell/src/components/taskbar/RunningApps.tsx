import { Tooltip } from '@khal-os/ui';
import { AnimatePresence, motion } from 'motion/react';
import { useWindowStore } from '../../stores/window-store';
import { AppIcon } from '../app-icon';

export function RunningApps() {
	const windowsByWorkspace = useWindowStore((s) => s.windowsByWorkspace);
	const activeWorkspaceId = useWindowStore((s) => s.activeWorkspaceId);
	const focusWindow = useWindowStore((s) => s.focusWindow);
	const minimizeWindow = useWindowStore((s) => s.minimizeWindow);

	const windows = activeWorkspaceId ? windowsByWorkspace[activeWorkspaceId] || [] : [];

	if (windows.length === 0) {
		return (
			<div className="flex items-center px-1">
				<span className="text-[11px] select-none" style={{ color: 'var(--khal-text-muted)' }}>
					No apps
				</span>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-0.5" role="tablist" aria-label="Running applications">
			<AnimatePresence mode="popLayout">
				{windows.map((win) => {
					const isActive = win.focused && !win.minimized;

					return (
						<motion.div
							key={win.id}
							layout
							initial={{ opacity: 0, scale: 0.5, width: 0 }}
							animate={{ opacity: 1, scale: 1, width: 'auto' }}
							exit={{ opacity: 0, scale: 0.5, width: 0 }}
							transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
						>
							<Tooltip text={win.title} position="top" delay delayTime={300} desktopOnly>
								<motion.button
									role="tab"
									aria-selected={isActive}
									aria-label={`${win.title}${isActive ? ' (active)' : win.minimized ? ' (minimized)' : ''}`}
									className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors"
									style={{
										background: isActive ? 'var(--khal-taskbar-active-bg)' : undefined,
									}}
									whileHover={{
										background: isActive ? undefined : 'var(--khal-taskbar-hover-bg)',
									}}
									whileTap={{ scale: 0.95 }}
									onClick={() => {
										if (isActive) {
											minimizeWindow(win.id);
										} else {
											focusWindow(win.id);
										}
									}}
								>
									<AppIcon appId={win.appId} size={32} className="h-8 w-8 shrink-0" />

									{/* Active dot indicator */}
									<span
										className="absolute -bottom-0.5 left-1/2 h-[3px] -translate-x-1/2 rounded-full transition-all"
										style={{
											width: isActive ? 8 : 4,
											background: isActive ? 'var(--khal-taskbar-active-indicator)' : 'var(--khal-text-muted)',
											opacity: isActive ? 1 : 0.5,
										}}
									/>
								</motion.button>
							</Tooltip>
						</motion.div>
					);
				})}
			</AnimatePresence>
		</div>
	);
}
