import { useDesktopStore } from '../../stores/desktop-store';

/**
 * React hook version -- subscribes to the desktop store.
 */
export function useResolvedIcon(appId: string): string | null {
	const apps = useDesktopStore((s) => s.apps);
	const entry = apps.find((a) => a.id === appId || a.component === appId);
	return entry?.icon ?? null;
}
