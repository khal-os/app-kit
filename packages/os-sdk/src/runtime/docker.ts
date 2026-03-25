/**
 * DockerRuntime — stub for Docker container execution.
 *
 * Not yet implemented. All methods throw.
 */

import { BaseRuntime } from './base';
import type { RuntimeHealth } from './types';

export class DockerRuntime extends BaseRuntime {
	readonly type = 'docker' as const;

	async ensureDeps(): Promise<void> {
		throw new Error('DockerRuntime not implemented yet');
	}

	async depsReady(): Promise<boolean> {
		throw new Error('DockerRuntime not implemented yet');
	}

	async start(): Promise<void> {
		throw new Error('DockerRuntime not implemented yet');
	}

	async stop(): Promise<void> {
		throw new Error('DockerRuntime not implemented yet');
	}

	url(): string {
		throw new Error('DockerRuntime not implemented yet');
	}

	async health(): Promise<RuntimeHealth> {
		throw new Error('DockerRuntime not implemented yet');
	}
}
