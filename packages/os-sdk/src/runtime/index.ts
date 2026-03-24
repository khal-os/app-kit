/**
 * @khal-os/sdk/runtime — pluggable runtime abstraction.
 *
 * Usage:
 *   import { createRuntime, detectBestRuntime } from '@khal-os/sdk/runtime';
 *   import type { Runtime, RuntimeConfig } from '@khal-os/sdk/runtime';
 *
 *   const runtime = await createRuntime({
 *     type: detectBestRuntime(),
 *     projectRoot: process.cwd(),
 *   });
 *   await runtime.start();
 */

// Base class (for custom runtimes)
export { AWSRuntime } from './aws';
export { AzureRuntime } from './azure';
export { BaseRuntime } from './base';
// Dependency helpers
export { defaultBinDir, ensureBinary, getBunUrl, getNatsUrl, isBinaryCached } from './deps';
export { DockerRuntime } from './docker';
// Factory
export { createRuntime, detectBestRuntime } from './factory';
export { FirecrackerRuntime } from './firecracker';
// Concrete implementations
export { LocalRuntime } from './local';
export { OCIRuntime } from './oci';
export { RemoteRuntime } from './remote';
// Types
export type {
	HealthStatus,
	Runtime,
	RuntimeConfig,
	RuntimeEvent,
	RuntimeEventHandler,
	RuntimeHealth,
	RuntimeType,
	ServiceHealth,
} from './types';
export { VercelSandboxRuntime } from './vercel';
