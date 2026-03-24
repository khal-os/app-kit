/**
 * Runtime types — core abstractions for the pluggable runtime system.
 *
 * Every runtime (local, remote, Vercel, Firecracker, Docker, AWS, Azure, OCI) implements
 * the `Runtime` interface. Config and events are shared across all runtimes.
 */

// ---------------------------------------------------------------------------
// Runtime type discriminator
// ---------------------------------------------------------------------------

export type RuntimeType = 'local' | 'remote' | 'vercel' | 'firecracker' | 'docker' | 'aws' | 'azure' | 'oci';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RuntimeConfig {
	/** Which runtime implementation to use. */
	type: RuntimeType;
	/** Remote server URL (required for 'remote'). */
	url?: string;
	/** Primary port for the runtime (e.g. Next.js port for 'local'). */
	port?: number;
	/** Directory for runtime data (binaries, PID files). Defaults to ~/.khal-os */
	dataDir?: string;
	/** Root of the project to run. */
	projectRoot: string;
	/** Extra environment variables passed to child processes. */
	env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealth {
	/** Service name (e.g. 'nats', 'next', 'ws-bridge'). */
	name: string;
	/** Current status. */
	status: HealthStatus;
	/** TCP port the service listens on, if applicable. */
	port?: number;
	/** OS process ID, if applicable. */
	pid?: number;
	/** Error message if status is unhealthy. */
	error?: string;
}

export interface RuntimeHealth {
	/** Overall runtime status. */
	status: HealthStatus;
	/** Individual service statuses. */
	services: ServiceHealth[];
	/** Seconds since runtime started. */
	uptime?: number;
	/** Runtime version string. */
	version?: string;
}

// ---------------------------------------------------------------------------
// Events (discriminated union)
// ---------------------------------------------------------------------------

export type RuntimeEvent =
	| { type: 'dep:downloading'; name: string; url: string }
	| { type: 'dep:ready'; name: string; path: string }
	| { type: 'service:starting'; name: string }
	| { type: 'service:ready'; name: string; port?: number; pid?: number }
	| { type: 'service:error'; name: string; error: string }
	| { type: 'service:stopped'; name: string; code?: number }
	| { type: 'runtime:ready' }
	| { type: 'runtime:error'; error: string }
	| { type: 'runtime:stopped' }
	| { type: 'log'; source: string; level: 'debug' | 'info' | 'warn' | 'error'; message: string };

// ---------------------------------------------------------------------------
// Runtime interface
// ---------------------------------------------------------------------------

export type RuntimeEventHandler = (event: RuntimeEvent) => void;

/**
 * The core Runtime interface. Every runtime implementation must satisfy this contract.
 */
export interface Runtime {
	/** Runtime type discriminator. */
	readonly type: RuntimeType;

	/** Start the runtime (download deps, spawn processes, wait for readiness). */
	start(): Promise<void>;

	/** Stop the runtime gracefully. */
	stop(): Promise<void>;

	/** Restart the runtime (stop + start). */
	restart(): Promise<void>;

	/** Return the base URL for the running instance. */
	url(): string;

	/** Return current health status of all managed services. */
	health(): Promise<RuntimeHealth>;

	/** Whether the runtime is currently running. */
	isRunning(): boolean;

	/** Ensure all binary dependencies are available. */
	ensureDeps(): Promise<void>;

	/** Check if all dependencies are already available (no download). */
	depsReady(): Promise<boolean>;

	/** Subscribe to runtime events. */
	on(handler: RuntimeEventHandler): void;

	/** Unsubscribe from runtime events. */
	off(handler: RuntimeEventHandler): void;
}
