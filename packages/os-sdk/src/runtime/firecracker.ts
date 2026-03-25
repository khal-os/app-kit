/**
 * FirecrackerRuntime — stub for Firecracker microVM execution.
 *
 * Not yet implemented. All methods throw.
 */

import { BaseRuntime } from './base';
import type { RuntimeHealth } from './types';

export class FirecrackerRuntime extends BaseRuntime {
	readonly type = 'firecracker' as const;

	async ensureDeps(): Promise<void> {
		throw new Error('FirecrackerRuntime not implemented yet');
	}

	async depsReady(): Promise<boolean> {
		throw new Error('FirecrackerRuntime not implemented yet');
	}

	async start(): Promise<void> {
		throw new Error('FirecrackerRuntime not implemented yet');
	}

	async stop(): Promise<void> {
		throw new Error('FirecrackerRuntime not implemented yet');
	}

	url(): string {
		throw new Error('FirecrackerRuntime not implemented yet');
	}

	async health(): Promise<RuntimeHealth> {
		throw new Error('FirecrackerRuntime not implemented yet');
	}
}
