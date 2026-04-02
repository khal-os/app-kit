import type { Role } from './roles';

/** Desktop integration metadata for an app. */
export interface AppDesktopConfig {
	/** Path to the app icon (relative to the public directory). */
	icon: string;
	/** Categories for desktop launcher grouping. */
	categories: string[];
	/** Short description shown in the desktop launcher. */
	comment: string;
}

/** A single view within an app manifest. */
export interface AppManifestView {
	/** Unique view identifier within the app. */
	id: string;
	/** Human-readable label for the view. */
	label: string;
	/** Permission string required to access this view. */
	permission: string;
	/** Minimum role level required. */
	minRole: Role;
	/** NATS subject segment after `khal.<orgId>.` for this view's services. */
	natsPrefix?: string;
	/** Default window dimensions. */
	defaultSize: { width: number; height: number };
	/** Relative path to the view's React component. */
	component: string;
}

/** Health check configuration for a service. */
export interface ServiceHealthConfig {
	/** Check type: tcp (connect to port), http (GET endpoint), command (run shell). */
	type: 'tcp' | 'http' | 'command';
	/** Target: port number for tcp, URL for http, shell command for command. */
	target: string | number;
	/** Check interval in milliseconds (default: 30000). */
	interval?: number;
	/** Timeout in milliseconds (default: 5000). */
	timeout?: number;
}

/** Service declaration within an app manifest. */
export interface AppServiceConfig {
	/** Service name (must be unique across the app). */
	name: string;
	/** Shell command to start the service (alternative to entry). */
	command?: string;
	/** Entry point file path relative to the package root. */
	entry?: string;
	/** Runtime environment. */
	runtime?: 'node' | 'python';
	/** Health check configuration. */
	health?: ServiceHealthConfig;
	/** Restart policy. */
	restart?: 'always' | 'on-failure' | 'never';
	/** Ports the service binds to internally. Khal assigns proxy ports. */
	ports?: number[];
}

/**
 * Full app manifest — the type for `manifest.ts` files in KhalOS app packages.
 *
 * Every app package must export a default manifest conforming to this shape.
 * Use `defineManifest()` for compile-time validation and autocomplete.
 */
export interface AppManifest {
	/** Unique app identifier (must match the package directory name). */
	id: string;
	/** One or more views the app exposes. */
	views: AppManifestView[];
	/** Desktop integration configuration. */
	desktop: AppDesktopConfig;
	/** Backend services this app runs. Optional — pure UI apps have no services. */
	services?: AppServiceConfig[];
}
