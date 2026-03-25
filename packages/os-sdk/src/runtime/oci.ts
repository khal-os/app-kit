/**
 * OCIRuntime — stub for OCI Container Instance execution.
 *
 * Future: ensureDeps() installs OCI CLI, start() provisions infra,
 * url() returns the provisioned URL, stop() tears down.
 */

import { BaseRuntime } from './base';
import type { RuntimeHealth } from './types';

export class OCIRuntime extends BaseRuntime {
	readonly type = 'oci' as const;

	async ensureDeps(): Promise<void> {
		throw new Error('OCIRuntime not implemented yet');
	}

	async depsReady(): Promise<boolean> {
		throw new Error('OCIRuntime not implemented yet');
	}

	async start(): Promise<void> {
		throw new Error('OCIRuntime not implemented yet');
	}

	async stop(): Promise<void> {
		throw new Error('OCIRuntime not implemented yet');
	}

	url(): string {
		throw new Error('OCIRuntime not implemented yet');
	}

	async health(): Promise<RuntimeHealth> {
		throw new Error('OCIRuntime not implemented yet');
	}
}
