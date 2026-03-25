/**
 * VercelSandboxRuntime — stub for Vercel sandbox execution.
 *
 * Not yet implemented. All methods throw.
 */

import { BaseRuntime } from './base';
import type { RuntimeHealth } from './types';

export class VercelSandboxRuntime extends BaseRuntime {
	readonly type = 'vercel' as const;

	async ensureDeps(): Promise<void> {
		throw new Error('VercelSandboxRuntime not implemented yet');
	}

	async depsReady(): Promise<boolean> {
		throw new Error('VercelSandboxRuntime not implemented yet');
	}

	async start(): Promise<void> {
		throw new Error('VercelSandboxRuntime not implemented yet');
	}

	async stop(): Promise<void> {
		throw new Error('VercelSandboxRuntime not implemented yet');
	}

	url(): string {
		throw new Error('VercelSandboxRuntime not implemented yet');
	}

	async health(): Promise<RuntimeHealth> {
		throw new Error('VercelSandboxRuntime not implemented yet');
	}
}
