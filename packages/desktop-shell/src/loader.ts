import type { ComponentType } from 'react';

/**
 * The resolved module shape returned by `loadPack()`.
 *
 * Every pack must default-export a React component. The optional `manifest`
 * field carries the pack's `khal-app.json` metadata when the pack re-exports
 * it (the full `KhalAppManifest` type will be defined by the pack-contract
 * wish — P1; we use a loose record here as a forward-compatible placeholder).
 */
export interface PackModule {
	default: ComponentType<any>;
	manifest?: Record<string, unknown>;
}

/**
 * Error thrown when a dynamic pack import fails.
 *
 * Wraps the original error so callers can inspect `cause` while getting
 * a human-readable message that includes the pack ID.
 */
export class PackLoadError extends Error {
	declare readonly cause?: Error;

	constructor(
		public readonly packId: string,
		cause?: Error,
	) {
		super(`Failed to load pack "${packId}"${cause ? `: ${cause.message}` : ''}`);
		this.name = 'PackLoadError';
		this.cause = cause;
	}
}

/**
 * Dynamically import a pack by its package name / ID.
 *
 * Uses `import()` with `@vite-ignore` so that Vite does not attempt to
 * statically analyze the import path — packs are resolved at runtime from
 * the host's `node_modules` or a registered alias.
 *
 * @param id - The pack's package name (e.g. `"@khal-os/pack-terminal"`)
 *             or a resolvable path.
 * @returns The pack module containing `default` (React component) and
 *          optional `manifest` metadata.
 * @throws {PackLoadError} When the import fails (pack not installed,
 *         module not found, syntax error, etc.).
 */
export async function loadPack(id: string): Promise<PackModule> {
	try {
		const mod = await import(/* @vite-ignore */ id);
		if (typeof mod.default !== 'function') {
			throw new Error('Pack module does not have a default export (expected a React component)');
		}
		return { default: mod.default, manifest: mod.manifest };
	} catch (err) {
		if (err instanceof PackLoadError) throw err;
		throw new PackLoadError(id, err instanceof Error ? err : new Error(String(err)));
	}
}
