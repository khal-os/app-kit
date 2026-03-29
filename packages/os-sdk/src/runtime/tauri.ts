/**
 * Tauri standalone supervisor — reads manifest, spawns services, monitors health.
 * Used when an app runs as a standalone Tauri desktop binary without Khal OS.
 *
 * In standalone mode:
 * - No NATS server (services communicate via Tauri IPC)
 * - No service-loader (this module replaces it)
 * - Frontend uses Tauri invoke() instead of NATS pub/sub
 */

import type { ChildProcess } from 'node:child_process';
import type { AppManifest, AppServiceConfig } from '../app/manifest';

export interface TauriManagedService {
	name: string;
	config: AppServiceConfig;
	process: ChildProcess | null;
	running: boolean;
	health: 'healthy' | 'unhealthy' | 'unknown';
	startedAt: number | null;
}

export interface TauriSupervisorConfig {
	/** The app manifest to read services from. */
	manifest: AppManifest;
	/** Working directory for spawning services. */
	cwd: string;
	/** Callback when a service health status changes. */
	onHealthChange?: (service: string, health: 'healthy' | 'unhealthy' | 'unknown') => void;
	/** Callback when a service starts. */
	onServiceStart?: (service: string, pid: number) => void;
	/** Callback when a service stops. */
	onServiceStop?: (service: string, code: number | null) => void;
}

/**
 * Create a Tauri standalone supervisor.
 * This is the TypeScript-side counterpart that would be called from Tauri Rust sidecar.
 *
 * NOTE: This is a design stub — full implementation requires Tauri Rust integration.
 * The TypeScript interface is defined here so that useService() can reference it,
 * and the actual Rust implementation will follow in a dedicated Tauri wish.
 */
export class TauriSupervisor {
	private services: Map<string, TauriManagedService> = new Map();
	private healthIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
	private config: TauriSupervisorConfig;

	constructor(config: TauriSupervisorConfig) {
		this.config = config;
	}

	/** Initialize supervisor from manifest. Does NOT start services yet. */
	async init(): Promise<void> {
		const svcConfigs = this.config.manifest.services ?? [];
		for (const svc of svcConfigs) {
			this.services.set(svc.name, {
				name: svc.name,
				config: svc,
				process: null,
				running: false,
				health: 'unknown',
				startedAt: null,
			});
		}
	}

	/** Start all declared services. */
	async startAll(): Promise<void> {
		for (const [name] of this.services) {
			await this.start(name);
		}
	}

	/** Start a specific service by name. */
	async start(name: string): Promise<void> {
		const svc = this.services.get(name);
		if (!svc || svc.running) return;

		// In a real implementation, this would spawn the process
		// For now, this is a stub that defines the interface
		console.log(`[tauri-supervisor] would start: ${name}`);
		svc.running = true;
		svc.startedAt = Date.now();
		svc.health = 'unknown';
	}

	/** Stop a specific service. */
	async stop(name: string): Promise<void> {
		const svc = this.services.get(name);
		if (!svc || !svc.running) return;

		if (svc.process) {
			svc.process.kill('SIGTERM');
		}
		svc.running = false;
		svc.process = null;
		svc.health = 'unhealthy';
		this.config.onServiceStop?.(name, 0);
	}

	/** Restart a specific service. */
	async restart(name: string): Promise<void> {
		await this.stop(name);
		await this.start(name);
	}

	/** Stop all services and clean up. */
	async shutdown(): Promise<void> {
		for (const interval of this.healthIntervals.values()) {
			clearInterval(interval);
		}
		this.healthIntervals.clear();
		for (const [name] of this.services) {
			await this.stop(name);
		}
	}

	/** Get status of all services. */
	getStatus(): Array<{ name: string; running: boolean; health: string; pid: number | null; uptime: number }> {
		return Array.from(this.services.values()).map((svc) => ({
			name: svc.name,
			running: svc.running,
			health: svc.health,
			pid: svc.process?.pid ?? null,
			uptime: svc.startedAt ? Math.floor((Date.now() - svc.startedAt) / 1000) : 0,
		}));
	}

	/** Get status of a specific service. */
	getServiceStatus(name: string) {
		const svc = this.services.get(name);
		if (!svc) return null;
		return {
			name: svc.name,
			running: svc.running,
			health: svc.health,
			pid: svc.process?.pid ?? null,
			uptime: svc.startedAt ? Math.floor((Date.now() - svc.startedAt) / 1000) : 0,
			ports: svc.config.ports ?? [],
		};
	}
}

/** Create a Tauri supervisor from a manifest. */
export function createTauriSupervisor(config: TauriSupervisorConfig): TauriSupervisor {
	return new TauriSupervisor(config);
}
