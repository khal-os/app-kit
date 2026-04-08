import { validateManifest, type KhalAppManifest } from '@khal-os/types';

export class PackLoadError extends Error {
	constructor(
		public readonly packId: string,
		cause?: unknown,
	) {
		super(
			cause
				? `Failed to load pack "${packId}": ${cause instanceof Error ? cause.message : String(cause)}`
				: `Failed to load pack "${packId}"`,
		);
		this.name = 'PackLoadError';
		this.cause = cause;
	}
}

export interface PackModule {
	default: React.ComponentType<{ manifest: KhalAppManifest; sdk: unknown }>;
	manifest: KhalAppManifest;
}

/** Cache for ESM bundles loaded by URL — avoids re-fetching on every render. */
const bundleCache = new Map<string, Promise<PackModule>>();

/**
 * Dynamically load a pack module by id (bundled apps — resolved at Vite build time).
 * Imports the pack package, validates its manifest, and returns the component + manifest.
 */
export async function loadPack(id: string): Promise<PackModule> {
	try {
		const mod = await import(`@khal-os/pack-${id}`);
		const manifest = validateManifest(mod.manifest);
		return { default: mod.default, manifest };
	} catch (err) {
		throw new PackLoadError(id, err);
	}
}

/**
 * Dynamically load a pack module from an ESM bundle URL (installed apps — runtime loading).
 * Uses `import()` with @vite-ignore to bypass Vite's static analysis.
 * Results are cached by URL so repeated calls don't re-fetch.
 */
export async function loadPackFromUrl(bundleUrl: string, id: string): Promise<PackModule> {
	const cached = bundleCache.get(bundleUrl);
	if (cached) return cached;

	const promise = (async () => {
		try {
			const mod = await import(/* @vite-ignore */ bundleUrl);
			const manifest = mod.manifest ? validateManifest(mod.manifest) : undefined;
			if (!mod.default) {
				throw new Error('Bundle does not export a default React component');
			}
			return { default: mod.default, manifest } as PackModule;
		} catch (err) {
			// Evict failed entry so a retry can re-attempt
			bundleCache.delete(bundleUrl);
			throw new PackLoadError(id, err);
		}
	})();

	bundleCache.set(bundleUrl, promise);
	return promise;
}

/** Clear the bundle cache (useful for testing or forced refresh). */
export function clearBundleCache(): void {
	bundleCache.clear();
}
