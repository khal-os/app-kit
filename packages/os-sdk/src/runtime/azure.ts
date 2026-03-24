/**
 * AzureRuntime — stub for Azure Container Apps execution.
 *
 * Future: ensureDeps() installs Azure CLI, start() provisions infra,
 * url() returns the provisioned URL, stop() tears down.
 */

import { BaseRuntime } from './base';
import type { RuntimeHealth } from './types';

export class AzureRuntime extends BaseRuntime {
	readonly type = 'azure' as const;

	async ensureDeps(): Promise<void> {
		throw new Error('AzureRuntime not implemented yet');
	}

	async depsReady(): Promise<boolean> {
		throw new Error('AzureRuntime not implemented yet');
	}

	async start(): Promise<void> {
		throw new Error('AzureRuntime not implemented yet');
	}

	async stop(): Promise<void> {
		throw new Error('AzureRuntime not implemented yet');
	}

	url(): string {
		throw new Error('AzureRuntime not implemented yet');
	}

	async health(): Promise<RuntimeHealth> {
		throw new Error('AzureRuntime not implemented yet');
	}
}
