import type { AppManifest } from '@khal-os/types';

export type {
	AppDeployConfig,
	AppDesktopConfig,
	AppEnvVar,
	AppManifest,
	AppManifestView,
	AppServiceConfig,
	AppTauriConfig,
	ServiceHealthConfig,
} from '@khal-os/types';

// Re-export the comprehensive validator from its dedicated module
export type { ManifestValidationResult } from './validate-manifest';
export { validateManifest } from './validate-manifest';

export function defineManifest<T extends AppManifest>(manifest: T): T {
	return manifest;
}
