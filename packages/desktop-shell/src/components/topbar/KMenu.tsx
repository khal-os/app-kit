import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowStore } from '../../stores/window-store';

/** Current app version -- sourced from package.json at build time or hardcoded fallback. */
const APP_VERSION = '1.0.0';

/** Detect Tauri runtime. */
function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI__' in window;
}

interface KMenuProps {
	open: boolean;
	onClose: () => void;
}

export function KMenu({ open, onClose }: KMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const [tauriMode, setTauriMode] = useState(false);

	useEffect(() => {
		setTauriMode(isTauri());
	}, []);

	/* Close on Escape */
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', handler, { capture: true });
		return () => window.removeEventListener('keydown', handler, { capture: true });
	}, [open, onClose]);

	/* Close on click outside */
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		// Use a timeout so the click that opened the menu doesn't immediately close it
		const timer = setTimeout(() => {
			window.addEventListener('mousedown', handler);
		}, 0);
		return () => {
			clearTimeout(timer);
			window.removeEventListener('mousedown', handler);
		};
	}, [open, onClose]);

	const handlePreferences = useCallback(() => {
		const openWindow = useWindowStore.getState().openWindow;
		openWindow({ title: 'Settings', appId: 'settings' });
		onClose();
	}, [onClose]);

	const handleSwitchMode = useCallback(() => {
		// biome-ignore lint/suspicious/noExplicitAny: Tauri global is untyped
		(window as any).__TAURI__?.core?.invoke('show_launcher');
		onClose();
	}, [onClose]);

	if (!open) return null;

	return (
		<div
			ref={menuRef}
			className="fixed z-[9600]"
			style={{
				top: 38,
				right: 8,
				minWidth: 200,
				background: 'var(--khal-surface-overlay)',
				backdropFilter: 'blur(40px) saturate(1.8)',
				WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
				border: '1px solid var(--khal-border-default)',
				borderRadius: 8,
				boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 0.5px rgba(255, 255, 255, 0.04)',
				padding: '4px 0',
			}}
		>
			{/* About Khal OS */}
			<div
				style={{
					padding: '8px 16px',
					fontSize: 13,
					color: 'var(--khal-text-secondary)',
					cursor: 'default',
					userSelect: 'none',
				}}
			>
				Khal OS v{APP_VERSION}
			</div>

			{/* Separator */}
			<div style={{ height: 1, background: 'var(--khal-border-default)', margin: '4px 0' }} />

			{/* Preferences */}
			<button
				type="button"
				onClick={handlePreferences}
				className="w-full text-left transition-colors"
				style={{
					padding: '8px 16px',
					fontSize: 13,
					color: 'var(--khal-text-primary)',
					background: 'transparent',
					border: 'none',
					cursor: 'default',
					display: 'block',
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = 'oklch(0.74 0.11 65 / 0.12)';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = 'transparent';
				}}
			>
				Preferences
			</button>

			{/* Switch Mode -- Tauri only */}
			{tauriMode && (
				<>
					{/* Separator */}
					<div style={{ height: 1, background: 'var(--khal-border-default)', margin: '4px 0' }} />

					<button
						type="button"
						onClick={handleSwitchMode}
						className="w-full text-left transition-colors"
						style={{
							padding: '8px 16px',
							fontSize: 13,
							color: 'var(--khal-text-primary)',
							background: 'transparent',
							border: 'none',
							cursor: 'default',
							display: 'block',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = 'oklch(0.74 0.11 65 / 0.12)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = 'transparent';
						}}
					>
						Switch Mode
					</button>
				</>
			)}
		</div>
	);
}
