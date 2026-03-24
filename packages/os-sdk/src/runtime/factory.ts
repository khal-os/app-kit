/**
 * Runtime factory — creates the appropriate runtime from config or auto-detects.
 */

import type { Runtime, RuntimeConfig, RuntimeType } from './types';

/**
 * Create a runtime instance from the given configuration.
 */
export async function createRuntime(config: RuntimeConfig): Promise<Runtime> {
	switch (config.type) {
		case 'local': {
			const { LocalRuntime } = await import('./local');
			return new LocalRuntime(config);
		}
		case 'remote': {
			const { RemoteRuntime } = await import('./remote');
			return new RemoteRuntime(config);
		}
		case 'vercel': {
			const { VercelSandboxRuntime } = await import('./vercel');
			return new VercelSandboxRuntime(config);
		}
		case 'firecracker': {
			const { FirecrackerRuntime } = await import('./firecracker');
			return new FirecrackerRuntime(config);
		}
		case 'docker': {
			const { DockerRuntime } = await import('./docker');
			return new DockerRuntime(config);
		}
		default: {
			const exhaustive: never = config.type;
			throw new Error(`Unknown runtime type: ${exhaustive}`);
		}
	}
}

/**
 * Detect the best runtime type for the current environment.
 *
 * Heuristics:
 * - If KHAL_RUNTIME env is set, use that.
 * - If KHAL_REMOTE_URL env is set, use 'remote'.
 * - If VERCEL env is set, use 'vercel'.
 * - Otherwise default to 'local'.
 */
export function detectBestRuntime(): RuntimeType {
	const explicit = process.env.KHAL_RUNTIME as RuntimeType | undefined;
	if (explicit && ['local', 'remote', 'vercel', 'firecracker', 'docker'].includes(explicit)) {
		return explicit;
	}

	if (process.env.KHAL_REMOTE_URL) {
		return 'remote';
	}

	if (process.env.VERCEL) {
		return 'vercel';
	}

	return 'local';
}
