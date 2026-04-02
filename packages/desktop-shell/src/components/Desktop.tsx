import { useKhalAuth } from '@khal-os/sdk/app';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from '@khal-os/ui';
import { useCallback } from 'react';
import { useLaunchApp } from '../hooks/useLaunchApp';
import { useIsMobile } from '../lib/hooks/use-is-mobile';
import { useFilteredDesktopApps } from '../stores/desktop-store';

interface DesktopProps {
	/** Permissions resolved server-side, used as fallback when client auth is unavailable. */
	serverPermissions?: string[];
}

export function Desktop({ serverPermissions }: DesktopProps) {
	const auth = useKhalAuth();
	const permissions = auth?.permissions ?? serverPermissions ?? [];
	const desktopApps = useFilteredDesktopApps(permissions);
	const launchApp = useLaunchApp();
	const isMobile = useIsMobile();

	const launchById = useCallback(
		(id: string) => {
			const entry = desktopApps.find((a) => a.id === id);
			if (entry) launchApp(entry);
		},
		[desktopApps, launchApp]
	);

	const hasPermission = useCallback((perm: string) => permissions.includes(perm), [permissions]);

	if (isMobile) {
		return <main className="fixed inset-0 overflow-hidden" aria-label="Desktop" />;
	}

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<main className="fixed inset-0 overflow-hidden" aria-label="Desktop" />
			</ContextMenuTrigger>
			<ContextMenuContent className="w-[200px] z-[9999]">
				{hasPermission('files') && <ContextMenuItem onClick={() => launchById('files')}>Files</ContextMenuItem>}
				{hasPermission('terminal') && (
					<ContextMenuItem onClick={() => launchById('terminal')}>Open Terminal</ContextMenuItem>
				)}
				{(hasPermission('files') || hasPermission('terminal')) && hasPermission('settings') && <ContextMenuSeparator />}
				{hasPermission('settings') && (
					<ContextMenuItem onClick={() => launchById('settings')}>Settings</ContextMenuItem>
				)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
