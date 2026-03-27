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
}

/**
 * Type-checked manifest builder with compile-time validation.
 *
 * Returns the manifest as-is — the type parameter provides full autocomplete
 * and catches structural errors at compile time.
 *
 * @example
 * ```ts
 * import { defineManifest } from '@khal-os/sdk/app';
 *
 * export default defineManifest({
 *   id: 'my-app',
 *   views: [{
 *     id: 'main',
 *     label: 'My App',
 *     permission: 'my-app',
 *     minRole: 'member',
 *     natsPrefix: 'myapp',
 *     defaultSize: { width: 800, height: 600 },
 *     component: './views/main/ui/App',
 *   }],
 *   desktop: {
 *     icon: '/icons/dusk/app.svg',
 *     categories: ['Utilities'],
 *     comment: 'Does something useful',
 *   },
 * });
 * ```
 */
export function defineManifest<T extends AppManifest>(manifest: T): T {
	return manifest;
}
