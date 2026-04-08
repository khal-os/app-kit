import { getNatsClient, useKhalAuth } from '@khal-os/sdk/app';
import { useNotificationStore } from '@khal-os/ui';
import { useCallback } from 'react';
import { useWindowStore } from '../stores/window-store';
import type { DesktopEntry } from '../types/desktop-entry';

/** Detect whether we are running inside a Tauri webview. */
function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Resolve the canonical app identifier for a desktop entry.
 */
export function getAppId(entry: DesktopEntry): string {
	return entry.component || entry.exec || entry.id;
}

const DEFAULT_WINDOW_SIZE = { width: 800, height: 600 };

/**
 * Check whether the given permissions list allows opening an app.
 * Returns true if the app's id is in the permissions list.
 *
 * NOTE: The original implementation depends on app-registry (core-specific).
 * In the desktop-shell package, we check if the appId is directly in the
 * permissions array. Consumers can provide a custom permission checker.
 */
export function hasAppPermission(appId: string, permissions: string[]): boolean {
	// If no permissions are set, allow all apps
	if (permissions.length === 0) return true;
	return permissions.includes(appId);
}

/**
 * Hook that returns a stable callback to launch any desktop entry.
 * Checks user permissions before opening; shows a notification if blocked.
 */
export function useLaunchApp() {
	const openWindow = useWindowStore((s) => s.openWindow);
	const auth = useKhalAuth();
	const permissions = auth?.permissions ?? [];

	const launch = useCallback(
		(entry: DesktopEntry) => {
			const appId = getAppId(entry);

			// Permission gate: block if user lacks required permission
			if (!hasAppPermission(appId, permissions)) {
				useNotificationStore.getState().addNotification({
					id: Date.now(),
					replacesId: 0,
					summary: 'Permission Denied',
					body: `You do not have permission to open ${entry.name}.`,
					icon: null,
					actions: [],
					expires: 4000,
					urgency: 'normal',
				});
				return;
			}

			// Tauri standalone: delegate window creation to the native shell
			if (isTauri()) {
				// biome-ignore lint/suspicious/noExplicitAny: Tauri global is untyped
				(window as any).__TAURI__?.core?.invoke('open_app_window', { appId, title: entry.name });
				return;
			}

			openWindow({ title: entry.name, appId, width: DEFAULT_WINDOW_SIZE.width, height: DEFAULT_WINDOW_SIZE.height });

			// Auto-track app launch (fire-and-forget, non-blocking)
			try {
				const client = getNatsClient();
				client.publish(
					'os.apps.run.start',
					JSON.stringify({
						appId: appId,
						trigger: 'manual',
						userId: auth?.userId ?? 'anonymous',
					})
				);
			} catch {
				// Non-blocking -- tracking failure should not affect app launch
			}
		},
		[openWindow, permissions, auth]
	);

	return launch;
}
