import type { AppManifest } from '@khal-os/types';

export type {
	AppDesktopConfig,
	AppManifest,
	AppManifestView,
	AppServiceConfig,
	ServiceHealthConfig,
} from '@khal-os/types';

export function defineManifest<T extends AppManifest>(manifest: T): T {
	return manifest;
}
