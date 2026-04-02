import { useConnectionState } from '../lib/hooks/use-connection-state';

interface BannerAction {
	label: string;
	onClick: () => void;
}

interface BannerConfig {
	text: string;
	color: string;
	action: BannerAction | null;
}

/**
 * Persistent banner shown below the TopBar when the NATS connection
 * is in a degraded state (reconnecting, auth expired, version mismatch).
 */
export function ConnectionBanner() {
	const { state, detail } = useConnectionState();

	// Don't show banner when connected or in initial disconnected state
	if (state === 'connected' || state === 'disconnected') return null;

	const configs: Record<string, BannerConfig> = {
		reconnecting: {
			text: 'Reconnecting to server\u2026',
			color: 'var(--khal-status-warning, #f59e0b)',
			action: null,
		},
		auth_expired: {
			text: 'Session expired.',
			color: 'var(--khal-status-error, #ef4444)',
			action: {
				label: 'Sign in again',
				onClick: () => {
					window.location.href = '/';
				},
			},
		},
		version_mismatch: {
			text: `Update required.${detail?.required ? ` Server requires v${detail.required}.` : ''}`,
			color: 'var(--khal-status-warning, #f59e0b)',
			action:
				detail?.download && typeof detail.download === 'string'
					? {
							label: 'Download',
							onClick: () => window.open(detail.download as string, '_blank'),
						}
					: null,
		},
	};

	const config = configs[state];
	if (!config) return null;

	return (
		<div
			style={{
				position: 'fixed',
				top: 36,
				left: 0,
				right: 0,
				zIndex: 9400,
				height: 32,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 12,
				background: 'var(--khal-surface)',
				backdropFilter: 'blur(20px) saturate(1.8)',
				WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
				borderLeft: `4px solid ${config.color}`,
				borderBottom: '1px solid var(--khal-taskbar-border)',
				fontSize: 13,
				color: 'var(--khal-text-primary)',
			}}
		>
			<span>{config.text}</span>
			{config.action && (
				<button
					type="button"
					onClick={config.action.onClick}
					style={{
						fontSize: 12,
						fontWeight: 500,
						color: config.color,
						background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
						border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
						borderRadius: 9999,
						padding: '2px 10px',
						cursor: 'default',
						lineHeight: '18px',
					}}
				>
					{config.action.label}
				</button>
			)}
		</div>
	);
}
