import { Tooltip, useNotificationStore } from '@khal-os/ui';
import { Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { UserMenu } from './UserMenu';

export function SystemTray() {
	const timeRef = useRef<HTMLSpanElement>(null);

	const unreadCount = useNotificationStore((s) => s.unreadCount);
	const toggleCenter = useNotificationStore((s) => s.toggleCenter);

	useEffect(() => {
		const update = () => {
			const now = new Date();
			if (timeRef.current) {
				timeRef.current.textContent = now.toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
				});
			}
		};
		update();
		const id = setInterval(update, 10_000);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="flex items-center gap-0.5">
			{/* Clock */}
			<Tooltip text="Current time" position="top" delay delayTime={400} desktopOnly>
				<span
					ref={timeRef}
					className="hidden px-1.5 text-[11px] font-medium tabular-nums select-none sm:inline"
					style={{ color: 'var(--khal-text-secondary)' }}
				/>
			</Tooltip>

			{/* Notification bell */}
			<Tooltip text="Notifications" position="top" delay delayTime={400} desktopOnly>
				<motion.button
					className="relative flex h-7 w-7 items-center justify-center rounded-full transition-colors"
					style={{ color: 'var(--khal-text-secondary)' }}
					whileHover={{
						scale: 1.08,
						background: 'var(--khal-taskbar-hover-bg)',
					}}
					whileTap={{ scale: 0.92 }}
					onClick={toggleCenter}
					aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
				>
					<Bell size={14} />
					{unreadCount > 0 && (
						<motion.span
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold"
							style={{
								background: 'var(--khal-accent-primary)',
								color: 'var(--khal-text-inverse)',
							}}
							aria-hidden="true"
						>
							{unreadCount > 99 ? '99+' : unreadCount}
						</motion.span>
					)}
				</motion.button>
			</Tooltip>

			{/* User avatar */}
			<UserMenu />
		</div>
	);
}
