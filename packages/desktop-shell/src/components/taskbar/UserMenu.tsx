import { useKhalAuth } from '@khal-os/sdk/app';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Tooltip,
} from '@khal-os/ui';
import { Building2, LogOut, Shield, User } from 'lucide-react';
import { useCallback, useRef } from 'react';

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__;

const ROLE_COLORS: Record<string, string> = {
	'platform-owner': 'var(--khal-accent-warning, #f59e0b)',
	'platform-admin': 'var(--khal-accent-primary)',
	'platform-dev': 'var(--khal-accent-secondary, #6366f1)',
	member: 'var(--khal-text-muted)',
};

const ROLE_LABELS: Record<string, string> = {
	'platform-owner': 'Owner',
	'platform-admin': 'Admin',
	'platform-dev': 'Developer',
	member: 'Member',
};

/**
 * UserMenu component.
 *
 * NOTE: The original UserMenu depends on WorkOS `useAuth()` and a server-side
 * logout form. In the desktop-shell package, we use `useKhalAuth()` from the SDK
 * which works with any auth provider. The logout mechanism is abstracted.
 */
export function UserMenu() {
	const khalAuth = useKhalAuth();

	const logoutFormRef = useRef<HTMLFormElement>(null);
	const handleLogout = useCallback(() => {
		if (isTauri) {
			(window as any).__TAURI__.core.invoke('switch_account').catch(console.error);
		} else {
			logoutFormRef.current?.submit();
		}
	}, []);

	if (khalAuth?.loading || !khalAuth?.userId) {
		return (
			<div
				className="flex h-7 w-7 items-center justify-center rounded-full"
				style={{ color: 'var(--khal-text-muted)' }}
			>
				<User size={14} />
			</div>
		);
	}

	const initial = khalAuth.userId.charAt(0).toUpperCase();
	const displayName = khalAuth.userId;
	const role = khalAuth.role ?? 'member';
	const roleColor = ROLE_COLORS[role] ?? ROLE_COLORS.member;

	return (
		<>
			{!isTauri && <form ref={logoutFormRef} method="POST" action="/auth/logout" className="hidden" />}
			<DropdownMenu>
				<Tooltip text={displayName} position="top" delay delayTime={400} desktopOnly>
					<DropdownMenuTrigger
						className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:scale-105 active:scale-95"
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLElement).style.background = 'var(--khal-taskbar-hover-bg)';
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLElement).style.background = '';
						}}
						aria-label="User menu"
					>
						<span
							className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
							style={{
								background: 'var(--khal-accent-primary)',
								color: 'var(--khal-text-inverse)',
							}}
						>
							{initial}
						</span>
					</DropdownMenuTrigger>
				</Tooltip>
				<DropdownMenuContent align="end" side="top" className="w-56">
					<DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
						<span className="text-copy-13 font-medium" style={{ color: 'var(--khal-text-primary)' }}>
							{displayName}
						</span>
					</DropdownMenuLabel>

					<DropdownMenuSeparator />

					{khalAuth.orgId && (
						<DropdownMenuItem disabled className="gap-2 opacity-100">
							<Building2 size={14} style={{ color: 'var(--khal-text-muted)' }} />
							<span className="truncate" style={{ color: 'var(--khal-text-secondary)' }}>
								{khalAuth.orgId}
							</span>
						</DropdownMenuItem>
					)}

					<DropdownMenuItem disabled className="gap-2 opacity-100">
						<Shield size={14} style={{ color: roleColor }} />
						<span
							className="rounded px-1.5 py-0.5 text-label-12 font-medium"
							style={{
								background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
								color: roleColor,
							}}
						>
							{ROLE_LABELS[role] ?? role}
						</span>
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem className="gap-2" onClick={handleLogout}>
						<LogOut size={14} />
						Logout
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
