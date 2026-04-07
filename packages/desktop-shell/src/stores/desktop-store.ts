import { getNatsClient } from '@khal-os/sdk/app';
import { useMemo } from 'react';
import { create } from 'zustand';
import type { DesktopEntry } from '../types/desktop-entry';

/** Icon paths for official Namastex apps, used when PG data lacks icon_url. */
const BUILTIN_ICONS: Record<string, string> = {
	terminal: '/icons/dusk/terminal.svg',
	files: '/icons/dusk/finder.svg',
	settings: '/icons/dusk/system_preferences.svg',
	'nats-viewer': '/icons/dusk/activity_monitor.svg',
	'mission-control': '/icons/dusk/mission_control.svg',
	genie: '/icons/dusk/automator.svg',
	ideas: '/icons/dusk/notes.svg',
	marketplace: '/icons/dusk/app_store.svg',
};

/**
 * Static fallback shown while PG data loads or when NATS/PG is unavailable.
 * Keeps the desktop usable with core system apps even if the backend is down.
 */
const FALLBACK_APPS: DesktopEntry[] = [
	{
		id: 'terminal',
		name: 'Terminal',
		icon: '/icons/dusk/terminal.svg',
		exec: null,
		type: 'builtin',
		component: 'terminal',
		categories: ['System'],
		comment: 'Terminal emulator',
		onDesktop: true,
	},
	{
		id: 'files',
		name: 'Files',
		icon: '/icons/dusk/finder.svg',
		exec: null,
		type: 'builtin',
		component: 'files',
		categories: ['System'],
		comment: 'File browser',
		onDesktop: true,
	},
	{
		id: 'settings',
		name: 'Settings',
		icon: '/icons/dusk/system_preferences.svg',
		exec: null,
		type: 'builtin',
		component: 'settings',
		categories: ['System'],
		comment: 'Desktop settings',
		onDesktop: true,
	},
	{
		id: 'marketplace',
		name: 'App Store',
		icon: '/icons/dusk/app_store.svg',
		exec: null,
		type: 'builtin',
		component: 'marketplace',
		categories: ['System'],
		comment: 'Browse and install apps',
		onDesktop: true,
	},
];

/** Shape of an installed app row joined with app_store from the NATS apps.list response. */
interface InstalledAppRow {
	slug: string;
	path: string;
	status: string;
	store: {
		name: string;
		slug: string;
		iconUrl: string | null;
		iconLucide: string | null;
		shortDescription: string | null;
		category: string | null;
		manifestJson: unknown;
		permission: string | null;
		natsPrefix: string | null;
		defaultWidth: number | null;
		defaultHeight: number | null;
		fullSizeContent: boolean | null;
		minRole: string | null;
	} | null;
}

/** Map a PG installed-app row to a DesktopEntry for the launcher. */
function mapRowToDesktopEntry(row: InstalledAppRow): DesktopEntry {
	return {
		id: row.slug,
		name: row.store?.name ?? row.slug,
		icon: row.store?.iconUrl ?? row.store?.iconLucide ?? BUILTIN_ICONS[row.slug] ?? '/icons/dusk/default.svg',
		exec: null,
		type: 'builtin',
		component: row.slug,
		categories: row.store?.category ? [row.store.category] : ['System'],
		comment: row.store?.shortDescription ?? null,
		onDesktop: true,
	};
}

interface DesktopStore {
	apps: DesktopEntry[];
	desktopIcons: DesktopEntry[];
	wallpaper: string;
	pinnedApps: string[];
	loading: boolean;
	/** Set when fetchApps fails -- lets UI distinguish "loading" from "failed". */
	fetchError: string | null;

	setApps: (apps: DesktopEntry[]) => void;
	setWallpaper: (url: string) => void;
	pinApp: (appId: string) => void;
	unpinApp: (appId: string) => void;
	/** Fetch installed apps from PG via NATS. Falls back to static list on failure. */
	fetchApps: () => Promise<void>;
	/**
	 * Optional callback: called after fetchApps succeeds with the raw PG rows.
	 * Consumers (core) can register dynamic manifests and refresh role permissions.
	 */
	onAppsLoaded: ((rows: InstalledAppRow[]) => void) | null;
	setOnAppsLoaded: (cb: ((rows: InstalledAppRow[]) => void) | null) => void;
}

export const useDesktopStore = create<DesktopStore>((set, get) => ({
	apps: FALLBACK_APPS,
	desktopIcons: FALLBACK_APPS,
	wallpaper: '/wallpapers/default.svg',
	pinnedApps: [],
	loading: true,
	fetchError: null,
	onAppsLoaded: null,

	setApps: (apps) => set({ apps, desktopIcons: apps }),
	setWallpaper: (url) => set({ wallpaper: url }),
	pinApp: (appId) =>
		set((state) => ({
			pinnedApps: state.pinnedApps.includes(appId) ? state.pinnedApps : [...state.pinnedApps, appId],
		})),
	unpinApp: (appId) =>
		set((state) => ({
			pinnedApps: state.pinnedApps.filter((id) => id !== appId),
		})),

	setOnAppsLoaded: (cb) => set({ onAppsLoaded: cb }),

	fetchApps: async () => {
		try {
			const client = getNatsClient();
			const raw = await client.request('os.apps.list', undefined, 8000);
			const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
				apps?: InstalledAppRow[];
				error?: string;
			};

			if (data.apps && data.apps.length > 0) {
				const filtered = data.apps.filter((r) => r.status !== 'error');

				// Notify consumer (core) to register dynamic manifests
				const callback = get().onAppsLoaded;
				if (callback) callback(filtered as InstalledAppRow[]);

				const entries = filtered.map(mapRowToDesktopEntry);
				if (entries.length > 0) {
					set({ apps: entries, desktopIcons: entries, loading: false });
					return;
				}
			}
		} catch (err) {
			// NATS unavailable or service not running -- keep fallback apps visible
			set({ fetchError: `Failed to load apps: ${err instanceof Error ? err.message : String(err)}` });
		}
		set({ loading: false });
	},
}));

/**
 * Returns desktop apps filtered by the given permissions array.
 * An app is included if its appId is in the permissions list or if the consumer
 * provides a custom filter function.
 *
 * NOTE: The original implementation depends on app-registry (core-specific).
 * In the desktop-shell package, we use a simpler approach: filter by
 * appId being present in the permissions array. Consumers can override
 * filtering by providing their own hook.
 */
export function useFilteredDesktopApps(permissions: string[]): DesktopEntry[] {
	const desktopIcons = useDesktopStore((s) => s.desktopIcons);

	return useMemo(() => {
		// If no permissions are provided, show all apps
		if (permissions.length === 0) return desktopIcons;
		return desktopIcons.filter((entry) => {
			const appId = entry.component ?? entry.id;
			// Allow app if its id is in the permissions list
			return permissions.includes(appId);
		});
	}, [desktopIcons, permissions]);
}
