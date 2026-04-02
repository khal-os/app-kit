import { motion } from 'motion/react';
import { AppLauncher } from './AppLauncher';
import { RunningApps } from './RunningApps';
import { SystemTray } from './SystemTray';

export function Taskbar({ onOpenPalette }: { onOpenPalette?: () => void }) {
	return (
		<motion.nav
			initial={{ opacity: 0, y: 16, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
			className="fixed inset-x-0 bottom-0 z-[9000] flex justify-center pb-2 pointer-events-none"
			aria-label="Taskbar"
		>
			<div
				className="pointer-events-auto flex h-10 items-center gap-0.5 rounded-xl px-1.5"
				style={{
					background: 'var(--khal-taskbar-bg)',
					backdropFilter: 'blur(40px) saturate(1.8)',
					WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
					border: '1px solid var(--khal-taskbar-border)',
					boxShadow: 'var(--khal-taskbar-shadow)',
				}}
			>
				<AppLauncher onOpenPalette={onOpenPalette} />

				<div className="mx-0.5 h-4 w-px shrink-0" style={{ background: 'var(--khal-taskbar-divider)' }} />

				<RunningApps />

				<div className="mx-0.5 h-4 w-px shrink-0" style={{ background: 'var(--khal-taskbar-divider)' }} />

				<SystemTray />
			</div>
		</motion.nav>
	);
}
