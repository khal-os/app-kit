import { useNotificationStore } from '@khal-os/ui';
import { X } from 'lucide-react';

export function NotificationToasts() {
	const notifications = useNotificationStore((s) => s.notifications);
	const dismissNotification = useNotificationStore((s) => s.dismissNotification);

	if (notifications.length === 0) return null;

	return (
		<div
			className="fixed top-3 right-3 z-[9500] flex w-80 flex-col gap-2"
			role="status"
			aria-live="polite"
			aria-label="Notifications"
		>
			{notifications.map((notif) => (
				<div
					key={`${notif.id}-${notif.timestamp}`}
					className="flex gap-3 rounded-lg p-3 backdrop-blur-xl"
					style={{
						animation: 'notif-slide-in 200ms ease-out',
						background: 'var(--khal-surface-overlay)',
						border: `1px solid ${notif.urgency === 'critical' ? 'rgba(239,68,68,0.5)' : 'var(--khal-border-default)'}`,
						boxShadow: 'var(--khal-shadow-lg)',
					}}
				>
					{notif.icon && <img src={notif.icon} alt="" className="h-8 w-8 shrink-0 rounded" />}
					<div className="min-w-0 flex-1">
						{notif.appName && (
							<p className="truncate text-label-12" style={{ color: 'var(--khal-text-muted)' }}>
								{notif.appName}
							</p>
						)}
						<p className="truncate text-label-13" style={{ color: 'var(--khal-text-primary)' }}>
							{notif.summary}
						</p>
						{notif.body && (
							<p className="mt-0.5 line-clamp-2 text-label-13" style={{ color: 'var(--khal-text-secondary)' }}>
								{notif.body}
							</p>
						)}
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
						onClick={() => dismissNotification(notif.id)}
						aria-label="Dismiss notification"
					>
						<X size={14} />
					</button>
				</div>
			))}
		</div>
	);
}
