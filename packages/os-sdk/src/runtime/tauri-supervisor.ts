/// <reference types="node" />
/**
 * Tauri Supervisor — standalone service runtime for exported KhalOS apps.
 *
 * Reads `khal-app.json` from the app root, spawns declared services,
 * monitors health, captures stdout/stderr, and restarts on failure.
 *
 * This is the headless counterpart to the core service-loader: it runs
 * inside the Tauri sidecar so exported apps can manage their own backends
 * without depending on the KhalOS platform.
 *
 * Usage (from Tauri src-tauri/main.rs or a Node sidecar):
 *   import { TauriSupervisor } from '@khal-os/sdk/runtime';
 *   const supervisor = new TauriSupervisor('/path/to/app');
 *   await supervisor.start();
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import type { AppManifest, AppServiceConfig, ServiceHealthConfig } from '@khal-os/types';

// ---------------------------------------------------------------------------
// Ring buffer for log capture
// ---------------------------------------------------------------------------

const DEFAULT_LOG_CAPACITY = 200;

class RingBuffer {
	private buf: string[];
	private head = 0;
	private count = 0;

	constructor(private capacity = DEFAULT_LOG_CAPACITY) {
		this.buf = new Array(capacity);
	}

	push(line: string): void {
		this.buf[this.head] = line;
		this.head = (this.head + 1) % this.capacity;
		if (this.count < this.capacity) this.count++;
	}

	lines(): string[] {
		if (this.count < this.capacity) return this.buf.slice(0, this.count);
		return [...this.buf.slice(this.head), ...this.buf.slice(0, this.head)];
	}
}

// ---------------------------------------------------------------------------
// Managed service state
// ---------------------------------------------------------------------------

interface ManagedService {
	name: string;
	config: AppServiceConfig;
	process: ChildProcess | null;
	running: boolean;
	retries: number;
	crashTimestamps: number[];
	circuitBroken: boolean;
	logBuffer: RingBuffer;
}

/** Service status snapshot returned by `getStatus()`. */
export interface ServiceStatus {
	name: string;
	running: boolean;
	retries: number;
	circuitBroken: boolean;
	logs: string[];
}

// ---------------------------------------------------------------------------
// Health probes
// ---------------------------------------------------------------------------

async function probeTcp(port: number, host = '127.0.0.1', timeoutMs = 5000): Promise<boolean> {
	return new Promise((ok) => {
		const socket = new net.Socket();
		socket.setTimeout(timeoutMs);
		socket.once('connect', () => {
			socket.destroy();
			ok(true);
		});
		socket.once('timeout', () => {
			socket.destroy();
			ok(false);
		});
		socket.once('error', () => {
			socket.destroy();
			ok(false);
		});
		socket.connect(port, host);
	});
}

async function probeHttp(url: string, timeoutMs = 5000): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timer);
		return res.ok;
	} catch {
		return false;
	}
}

async function checkHealth(health: ServiceHealthConfig | undefined): Promise<'healthy' | 'unhealthy' | 'unknown'> {
	if (!health) return 'unknown';
	const timeout = health.timeout ?? 5000;
	switch (health.type) {
		case 'tcp': {
			const port = typeof health.target === 'number' ? health.target : Number.parseInt(String(health.target), 10);
			return (await probeTcp(port, '127.0.0.1', timeout)) ? 'healthy' : 'unhealthy';
		}
		case 'http': {
			const url = String(health.target);
			return (await probeHttp(url, timeout)) ? 'healthy' : 'unhealthy';
		}
		default:
			return 'unknown';
	}
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

const CIRCUIT_WINDOW_MS = 60_000;
const CIRCUIT_THRESHOLD = 5;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3_000;

function shouldTrip(service: ManagedService): boolean {
	const now = Date.now();
	service.crashTimestamps = service.crashTimestamps.filter((t) => now - t < CIRCUIT_WINDOW_MS);
	return service.crashTimestamps.length >= CIRCUIT_THRESHOLD || service.retries >= MAX_RETRIES;
}

// ---------------------------------------------------------------------------
// TauriSupervisor
// ---------------------------------------------------------------------------

export interface TauriSupervisorOptions {
	/** Override the manifest file name (default: khal-app.json). */
	manifestFile?: string;
	/** Called when a service status changes. */
	onStatusChange?: (name: string, running: boolean) => void;
	/** Called when a service writes to stdout/stderr. */
	onLog?: (name: string, line: string) => void;
}

/**
 * Standalone service supervisor for exported KhalOS apps.
 *
 * Reads `khal-app.json`, spawns each declared service, monitors health,
 * captures logs, and restarts on failure with circuit breaker protection.
 */
export class TauriSupervisor {
	private appRoot: string;
	private manifest: AppManifest | null = null;
	private services: ManagedService[] = [];
	private healthInterval: ReturnType<typeof setInterval> | null = null;
	private opts: TauriSupervisorOptions;
	private stopped = false;

	constructor(appRoot: string, opts: TauriSupervisorOptions = {}) {
		this.appRoot = resolve(appRoot);
		this.opts = opts;
	}

	/** Load and return the parsed manifest. */
	getManifest(): AppManifest | null {
		return this.manifest;
	}

	/** Return a status snapshot for all managed services. */
	getStatus(): ServiceStatus[] {
		return this.services.map((s) => ({
			name: s.name,
			running: s.running,
			retries: s.retries,
			circuitBroken: s.circuitBroken,
			logs: s.logBuffer.lines(),
		}));
	}

	/** Start the supervisor — reads manifest and spawns services. */
	async start(): Promise<void> {
		this.stopped = false;
		this.manifest = this.loadManifest();

		if (!this.manifest.services?.length) {
			console.log('[tauri-supervisor] No services declared in manifest.');
			return;
		}

		for (const svcConfig of this.manifest.services) {
			const managed: ManagedService = {
				name: svcConfig.name,
				config: svcConfig,
				process: null,
				running: false,
				retries: 0,
				crashTimestamps: [],
				circuitBroken: false,
				logBuffer: new RingBuffer(),
			};
			this.services.push(managed);
			this.spawnService(managed);
		}

		// Periodic health checks
		this.healthInterval = setInterval(() => this.runHealthChecks(), 30_000);
		console.log(`[tauri-supervisor] Started ${this.services.length} service(s).`);
	}

	/** Gracefully stop all services. */
	async stop(): Promise<void> {
		this.stopped = true;
		if (this.healthInterval) {
			clearInterval(this.healthInterval);
			this.healthInterval = null;
		}
		for (const svc of this.services) {
			this.killService(svc);
		}
		this.services = [];
		console.log('[tauri-supervisor] All services stopped.');
	}

	/** Restart a specific service by name. */
	restart(serviceName: string): boolean {
		const svc = this.services.find((s) => s.name === serviceName);
		if (!svc) return false;
		this.killService(svc);
		svc.retries = 0;
		svc.circuitBroken = false;
		svc.crashTimestamps = [];
		this.spawnService(svc);
		return true;
	}

	// ── Private ──────────────────────────────────────────────────────────

	private loadManifest(): AppManifest {
		const fileName = this.opts.manifestFile ?? 'khal-app.json';
		const manifestPath = resolve(this.appRoot, fileName);
		if (!existsSync(manifestPath)) {
			throw new Error(`[tauri-supervisor] Manifest not found: ${manifestPath}`);
		}
		const raw = readFileSync(manifestPath, 'utf8');
		return JSON.parse(raw) as AppManifest;
	}

	private spawnService(svc: ManagedService): void {
		if (this.stopped || svc.circuitBroken) return;

		const { config } = svc;
		const cwd = this.appRoot;
		let cmd: string[];

		if (config.command) {
			const parts = config.command.split(/\s+/);
			cmd = parts;
		} else if (config.entry) {
			const entryPath = resolve(cwd, config.entry);
			if (config.runtime === 'python') {
				cmd = ['python3', entryPath];
			} else {
				cmd = ['npx', 'tsx', entryPath];
			}
		} else {
			console.error(`[tauri-supervisor] ${svc.name}: no command or entry specified`);
			return;
		}

		try {
			const proc = spawn(cmd[0], cmd.slice(1), {
				cwd,
				stdio: ['ignore', 'pipe', 'pipe'],
				env: { ...process.env, KHAL_STANDALONE: '1', KHAL_APP_ID: this.manifest?.id ?? '' },
			});

			svc.process = proc;
			svc.running = true;
			this.opts.onStatusChange?.(svc.name, true);

			const capture = (stream: ChildProcess['stdout']) => {
				if (!stream) return;
				stream.setEncoding('utf8');
				stream.on('data', (chunk: string) => {
					for (const line of chunk.split('\n')) {
						if (line) {
							svc.logBuffer.push(line);
							this.opts.onLog?.(svc.name, line);
						}
					}
				});
			};

			capture(proc.stdout);
			capture(proc.stderr);

			proc.on('error', (err: Error) => {
				console.error(`[tauri-supervisor] ${svc.name} spawn error: ${err.message}`);
				svc.running = false;
				svc.process = null;
				this.opts.onStatusChange?.(svc.name, false);
			});

			proc.on('exit', (code: number | null) => {
				svc.running = false;
				svc.process = null;
				this.opts.onStatusChange?.(svc.name, false);

				if (this.stopped) return;

				const policy = config.restart ?? 'on-failure';
				const shouldRestart = policy === 'always' || (policy === 'on-failure' && code !== 0);

				if (shouldRestart) {
					svc.retries++;
					svc.crashTimestamps.push(Date.now());

					if (shouldTrip(svc)) {
						svc.circuitBroken = true;
						console.error(`[tauri-supervisor] ${svc.name}: circuit breaker tripped after ${svc.retries} retries`);
						return;
					}

					console.log(`[tauri-supervisor] ${svc.name} exited (code ${code}), restarting in ${RETRY_DELAY_MS}ms...`);
					setTimeout(() => this.spawnService(svc), RETRY_DELAY_MS);
				} else {
					console.log(`[tauri-supervisor] ${svc.name} exited (code ${code}), not restarting (policy: ${policy})`);
				}
			});
		} catch (err) {
			console.error(`[tauri-supervisor] Failed to spawn ${svc.name}: ${err}`);
			svc.running = false;
		}
	}

	private killService(svc: ManagedService): void {
		if (svc.process) {
			svc.process.removeAllListeners();
			svc.process.kill('SIGTERM');
			// Force kill after 5s if still alive
			const proc = svc.process;
			setTimeout(() => {
				try {
					proc.kill('SIGKILL');
				} catch {
					/* already dead */
				}
			}, 5000);
			svc.process = null;
			svc.running = false;
		}
	}

	private async runHealthChecks(): Promise<void> {
		for (const svc of this.services) {
			if (!svc.running || !svc.config.health) continue;
			const status = await checkHealth(svc.config.health);
			if (status === 'unhealthy') {
				console.warn(`[tauri-supervisor] ${svc.name}: health check failed, restarting...`);
				this.killService(svc);
				svc.retries++;
				svc.crashTimestamps.push(Date.now());
				if (!shouldTrip(svc)) {
					setTimeout(() => this.spawnService(svc), RETRY_DELAY_MS);
				} else {
					svc.circuitBroken = true;
					console.error(`[tauri-supervisor] ${svc.name}: circuit breaker tripped after health failures`);
				}
			}
		}
	}
}
