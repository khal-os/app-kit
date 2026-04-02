import { KhalLogo, Tooltip } from '@khal-os/ui';
import { motion } from 'motion/react';

interface AppLauncherProps {
	onOpenPalette?: () => void;
}

export function AppLauncher({ onOpenPalette }: AppLauncherProps) {
	return (
		<Tooltip text="App launcher (Cmd+K)" position="top" delay delayTime={400} desktopOnly>
			<motion.button
				className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200"
				style={{ color: 'var(--khal-text-secondary)' }}
				whileHover={{
					scale: 1.1,
					background: 'oklch(0.74 0.11 65 / 0.12)',
					boxShadow: '0 0 12px oklch(0.74 0.11 65 / 0.3)',
				}}
				whileTap={{ scale: 0.92 }}
				onClick={onOpenPalette}
				aria-label="Open app launcher"
			>
				{/* K icon from SVG wordmark -- small size renders just the K letterform */}
				<KhalLogo size={18} variant="light" />
			</motion.button>
		</Tooltip>
	);
}
