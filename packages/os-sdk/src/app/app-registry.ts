/**
 * App Registry — static app manifest and RBAC permission data.
 *
 * Migrated from khal-os/core `src/components/apps/app-manifest.ts` so that
 * server-side code (ws-bridge, ws-server) can import RBAC data without
 * depending on the frontend component tree.
 *
 * Each app declares its metadata here. This is the single source of truth
 * for app identity, permissions, NATS subject prefixes, and access levels.
 */

import { computeRolePermissions, type Role, registerRolePermissions } from './roles';

// Re-export from roles for backward compatibility
export { ROLE_HIERARCHY, type Role } from './roles';

/** Store metadata for the Settings tab in tabbed windows. */
export interface AppStoreMeta {
	name: string;
	version: string;
	author: string;
	description: string;
	permissions?: string[];
}

export interface AppManifestEntry {
	label: string;
	/** Permission string required to use this app. */
	permission: string;
	/** Minimum role required to access this app. */
	minRole: Role;
	/** NATS subject segment after `khal.<orgId>.` — if the app uses NATS subjects. */
	natsPrefix?: string;
	defaultSize: { width: number; height: number };
	/**
	 * When true, the window skips the normal WindowFrame/WindowContent wrapper.
	 * The app renders its entire surface including the title bar area.
	 * Floating window controls (min/max/close) overlay on top.
	 */
	fullSizeContent?: boolean;
	/** When true, the window shows a tab bar (UI | Settings). Default false for backward compat. */
	showTabs?: boolean;
	/** App store metadata displayed in the Settings tab. */
	storeMeta?: AppStoreMeta;
	/** Voice agent configuration. When set, the window shows a mic button (requires HELLO). */
	voice?: {
		/** Slug of the voice agent to connect to (registered in hello-agent-manager). */
		agentSlug: string;
		/** Label shown in the voice panel header. Defaults to "{app.label} Assistant". */
		label?: string;
	};
}

export type AppId = string;

export const APP_MANIFEST: Record<string, AppManifestEntry> = {
	terminal: {
		label: 'Terminal',
		permission: 'terminal',
		minRole: 'platform-dev',
		natsPrefix: 'pty',
		defaultSize: { width: 720, height: 480 },
		fullSizeContent: true,
		voice: { agentSlug: 'terminal-assistant', label: 'Terminal Assistant' },
	},
	settings: {
		label: 'Settings',
		permission: 'settings',
		minRole: 'platform-dev',
		defaultSize: { width: 800, height: 600 },
	},
	files: {
		label: 'Files',
		permission: 'files',
		minRole: 'member',
		natsPrefix: 'fs',
		defaultSize: { width: 800, height: 600 },
		voice: { agentSlug: 'files-assistant', label: 'Files Assistant' },
	},
	'nats-viewer': {
		label: 'NATS Viewer',
		permission: 'nats-viewer',
		minRole: 'platform-dev',
		defaultSize: { width: 900, height: 600 },
	},
	'mission-control': {
		label: 'Mission Control',
		permission: 'mission-control',
		minRole: 'member',
		natsPrefix: 'task',
		defaultSize: { width: 1200, height: 800 },
		showTabs: true,
		storeMeta: {
			name: 'Mission Control',
			version: '0.0.1',
			author: 'Namastex Labs',
			description: 'See all your tasks flow through stages. Switch between project boards.',
			permissions: ['nats:os.genie.task.*', 'nats:os.genie.project.*'],
		},
		voice: { agentSlug: 'mission-control-assistant', label: 'Mission Control Assistant' },
	},
	genie: {
		label: 'Genie',
		permission: 'genie',
		minRole: 'platform-dev',
		natsPrefix: 'genie',
		defaultSize: { width: 960, height: 640 },
	},
	ideas: {
		label: 'Ideas',
		permission: 'ideas',
		minRole: 'member',
		defaultSize: { width: 800, height: 600 },
	},
	marketplace: {
		label: 'App Store',
		permission: 'marketplace',
		minRole: 'member',
		natsPrefix: 'apps',
		defaultSize: { width: 1000, height: 700 },
	},
};

/**
 * Dynamic manifest entries registered at runtime from PG.
 * These extend the static APP_MANIFEST for apps installed after boot.
 */
const dynamicManifest = new Map<string, AppManifestEntry>();

/**
 * Register a manifest entry at runtime (e.g. from PG app data).
 * Does not overwrite static core entries in APP_MANIFEST.
 */
export function registerManifestEntry(id: string, entry: AppManifestEntry): void {
	if (!(id in APP_MANIFEST)) {
		dynamicManifest.set(id, entry);
	}
}

/**
 * Look up a manifest entry by app ID. Checks static core manifest first,
 * then falls back to dynamically registered entries from PG.
 */
export function getManifestEntry(id: string): AppManifestEntry | undefined {
	return APP_MANIFEST[id] ?? dynamicManifest.get(id);
}

/** Resolve the voice agent slug for an app. Falls back to 'khal-assistant'. */
export function getVoiceAgentSlug(appId: string): string {
	const entry = getManifestEntry(appId);
	return entry?.voice?.agentSlug ?? 'khal-assistant';
}

/** Get voice label for an app. Falls back to "{appLabel} Assistant". */
export function getVoiceLabel(appId: string): string {
	const entry = getManifestEntry(appId);
	return entry?.voice?.label ?? `${entry?.label ?? appId} Assistant`;
}

/**
 * Derived: NATS subject segment -> required permission.
 * Used by the WS bridge for server-side subject-level access control.
 */
export const SUBJECT_PERMISSIONS: Record<string, string> = {
	...Object.fromEntries(
		Object.values(APP_MANIFEST)
			.filter((e) => e.natsPrefix)
			.map((e) => [e.natsPrefix, e.permission])
	),
	desktop: 'desktop',
};

/**
 * Derived: role -> list of permissions granted.
 * Computed via the SDK's computeRolePermissions and registered so that
 * useKhalAuth() returns the correct permissions for each role.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = computeRolePermissions(APP_MANIFEST);

// Register with the SDK so useKhalAuth() returns correct permissions
registerRolePermissions(DEFAULT_ROLE_PERMISSIONS);

/**
 * Recompute role permissions including dynamic manifest entries.
 * Call after registerPackageApps() to ensure dynamically installed apps
 * are included in permission checks (e.g. desktop icon filtering).
 */
export function refreshRolePermissions(): void {
	const allManifest: Record<string, { permission: string; minRole: Role }> = { ...APP_MANIFEST };
	for (const [id, entry] of dynamicManifest) {
		allManifest[id] = entry;
	}
	const updated = computeRolePermissions(allManifest);
	Object.assign(DEFAULT_ROLE_PERMISSIONS, updated);
	registerRolePermissions(updated);
}
