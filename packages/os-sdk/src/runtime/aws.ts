/**
 * AWSRuntime — stub for AWS (EC2/ECS/Fargate) execution.
 *
 * Future: ensureDeps() installs AWS CLI, start() provisions infra,
 * url() returns the provisioned URL, stop() tears down.
 */

import { BaseRuntime } from './base';
import type { RuntimeHealth } from './types';

export class AWSRuntime extends BaseRuntime {
	readonly type = 'aws' as const;

	async ensureDeps(): Promise<void> {
		throw new Error('AWSRuntime not implemented yet');
	}

	async depsReady(): Promise<boolean> {
		throw new Error('AWSRuntime not implemented yet');
	}

	async start(): Promise<void> {
		throw new Error('AWSRuntime not implemented yet');
	}

	async stop(): Promise<void> {
		throw new Error('AWSRuntime not implemented yet');
	}

	url(): string {
		throw new Error('AWSRuntime not implemented yet');
	}

	async health(): Promise<RuntimeHealth> {
		throw new Error('AWSRuntime not implemented yet');
	}
}
