import { validateManifest, type KhalAppManifest } from '@khal-os/types';

export class PackLoadError extends Error {
	constructor(
		public readonly packId: string,
		cause: unknown,
	) {
		super(
			`Failed to load pack "${packId}": ${cause instanceof Error ? cause.message : String(cause)}`,
		);
		this.name = 'PackLoadError';
		this.cause = cause;
	}
}

export interface PackModule {
	default: React.ComponentType<{ manifest: KhalAppManifest; sdk: unknown }>;
	manifest: KhalAppManifest;
}

/**
 * Dynamically load a pack module by id.
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
