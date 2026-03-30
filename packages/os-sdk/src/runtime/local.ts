/**
 * LocalRuntime — runs KhalOS services as local child processes.
 *
 * Manages: NATS server, service-loader, ws-bridge, Next.js dev server.
 * Downloads NATS binary via deps.ts if not cached.
 * Uses Node.js child_process, net, fs, os — server-side only.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BaseRuntime } from './base';
import { detectArch, detectPlatform, ensureBinary, getNatsUrl, isBinaryCached } from './deps';
import type { HealthStatus, RuntimeConfig, RuntimeHealth, ServiceHealth } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NATS_VERSION = '2.10.24';

const NATS_PORT = 4222;
const WS_BRIDGE_PORT = 4280;
const NEXT_PORT = 8888;

const STOP_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for a TCP port to accept connections.
 */
function waitForPort(port: number, host = '127.0.0.1', timeoutMs = 30_000): Promise<void> {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + timeoutMs;

		function attempt() {
			if (Date.now() > deadline) {
				reject(new Error(`Port ${port} did not become available within ${timeoutMs}ms`));
				return;
			}

			const socket = createConnection({ port, host });

			socket.once('connect', () => {
				socket.destroy();
				resolve();
			});

			socket.once('error', () => {
				socket.destroy();
				setTimeout(attempt, 250);
			});
		}

		attempt();
	});
}

/**
 * Check if a TCP port is currently accepting connections.
 */
function probePort(port: number, host = '127.0.0.1'): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host });
		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('error', () => {
			socket.destroy();
			resolve(false);
		});
		// Short timeout for health checks.
		socket.setTimeout(2_000, () => {
			socket.destroy();
			resolve(false);
		});
	});
}

/**
 * Generate a random hex secret for OS_SECRET.
 */
function generateSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// ---------------------------------------------------------------------------
// ManagedProcess — wraps a ChildProcess with metadata
// ---------------------------------------------------------------------------

interface ManagedProcess {
	name: string;
	process: ChildProcess;
	port?: number;
}

// ---------------------------------------------------------------------------
// LocalRuntime
// ---------------------------------------------------------------------------

export class LocalRuntime extends BaseRuntime {
	readonly type = 'local' as const;

	private children: ManagedProcess[] = [];
	private natsBin = '';
	private dataDir: string;
	private startedAt: number | undefined;

	constructor(config: RuntimeConfig) {
		super(config);
		this.dataDir = config.dataDir ?? join(homedir(), '.khal-os');
	}

	// -----------------------------------------------------------------------
	// Dependencies
	// -----------------------------------------------------------------------

	async ensureDeps(): Promise<void> {
		const binDir = join(this.dataDir, 'bin');
		const platform = detectPlatform();
		const arch = detectArch();

		const emitter = (event: Parameters<typeof this.emit>[0]) => this.emit(event);

		this.natsBin = await ensureBinary(
			'nats-server',
			NATS_VERSION,
			binDir,
			getNatsUrl(NATS_VERSION, platform, arch),
			emitter
		);
	}

	async depsReady(): Promise<boolean> {
		const binDir = join(this.dataDir, 'bin');
		return isBinaryCached('nats-server', NATS_VERSION, binDir);
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	async start(): Promise<void> {
		if (this.running) return;

		await this.ensureDeps();
		this.writePidFile();

		const env = {
			...process.env,
			...this.config.env,
			OS_SECRET: this.config.env?.OS_SECRET ?? generateSecret(),
			NEXT_PUBLIC_KHAL_MODE: 'local',
			NEXT_PUBLIC_KHAL_INSTANCE_ID: this.config.env?.KHAL_INSTANCE_ID ?? 'default',
		};

		const projectRoot = this.config.projectRoot;
		const port = this.config.port ?? NEXT_PORT;

		// 1. NATS server
		this.spawnChild('nats', this.natsBin, ['--port', String(NATS_PORT), '--jetstream'], {
			cwd: projectRoot,
			env,
			port: NATS_PORT,
		});
		await waitForPort(NATS_PORT);

		// 2. Service loader (discovers and runs KhalOS services)
		this.spawnChild('services', 'npx', ['tsx', 'src/lib/service-loader.ts'], {
			cwd: projectRoot,
			env,
		});

		// 3. WebSocket bridge (NATS <-> browser)
		this.spawnChild('ws-bridge', 'npx', ['tsx', 'src/lib/ws-server.ts'], {
			cwd: projectRoot,
			env,
			port: WS_BRIDGE_PORT,
		});

		// 4. Next.js dev server
		this.spawnChild('next', 'npx', ['next', 'dev', '--port', String(port)], {
			cwd: projectRoot,
			env,
			port,
		});

		// Wait for Next.js to be ready.
		await waitForPort(port);

		this.running = true;
		this.startedAt = Date.now();
		this.emit({ type: 'runtime:ready' });
	}

	async stop(): Promise<void> {
		if (!this.running) return;

		this.running = false;

		// SIGTERM all children.
		for (const child of this.children) {
			this.emit({ type: 'service:stopped', name: child.name });
			if (child.process.pid && !child.process.killed) {
				child.process.kill('SIGTERM');
			}
		}

		// Wait up to STOP_TIMEOUT_MS for clean exit, then SIGKILL.
		await Promise.all(
			this.children.map(
				(child) =>
					new Promise<void>((resolve) => {
						const timer = setTimeout(() => {
							if (child.process.pid && !child.process.killed) {
								child.process.kill('SIGKILL');
							}
							resolve();
						}, STOP_TIMEOUT_MS);

						child.process.once('exit', () => {
							clearTimeout(timer);
							resolve();
						});
					})
			)
		);

		this.children = [];
		this.removePidFile();
		this.startedAt = undefined;
		this.emit({ type: 'runtime:stopped' });
	}

	url(): string {
		const port = this.config.port ?? NEXT_PORT;
		return `http://localhost:${port}`;
	}

	async health(): Promise<RuntimeHealth> {
		const services: ServiceHealth[] = await Promise.all(
			this.children.map(async (child) => {
				const alive = child.process.pid != null && !child.process.killed;
				let portOpen = false;
				if (child.port) {
					portOpen = await probePort(child.port);
				}

				const status: HealthStatus = alive && (!child.port || portOpen) ? 'healthy' : 'unhealthy';

				return {
					name: child.name,
					status,
					port: child.port,
					pid: child.process.pid,
					...(status === 'unhealthy' ? { error: alive ? 'port not responding' : 'process not running' } : {}),
				};
			})
		);

		const allHealthy = services.every((s) => s.status === 'healthy');
		const anyUnhealthy = services.some((s) => s.status === 'unhealthy');

		let overall: HealthStatus = 'unknown';
		if (allHealthy && services.length > 0) overall = 'healthy';
		else if (anyUnhealthy) overall = 'degraded';

		return {
			status: overall,
			services,
			uptime: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : undefined,
		};
	}

	// -----------------------------------------------------------------------
	// Internals
	// -----------------------------------------------------------------------

	private spawnChild(
		name: string,
		command: string,
		args: string[],
		opts: { cwd: string; env: Record<string, string | undefined>; port?: number }
	): void {
		this.emit({ type: 'service:starting', name });

		const child = spawn(command, args, {
			cwd: opts.cwd,
			env: opts.env as NodeJS.ProcessEnv,
			stdio: 'pipe',
		});

		const managed: ManagedProcess = { name, process: child, port: opts.port };
		this.children.push(managed);

		child.stdout?.on('data', (data: Buffer) => {
			this.emit({ type: 'log', source: name, level: 'info', message: data.toString().trimEnd() });
		});

		child.stderr?.on('data', (data: Buffer) => {
			this.emit({ type: 'log', source: name, level: 'error', message: data.toString().trimEnd() });
		});

		child.once('exit', (code) => {
			if (this.running) {
				this.emit({ type: 'service:error', name, error: `exited with code ${code}` });
			}
		});

		if (child.pid) {
			this.emit({ type: 'service:ready', name, port: opts.port, pid: child.pid });
		}
	}

	private pidFilePath(): string {
		return join(this.dataDir, 'khal-os.pid');
	}

	private writePidFile(): void {
		mkdirSync(this.dataDir, { recursive: true });
		writeFileSync(this.pidFilePath(), String(process.pid), 'utf8');
	}

	private removePidFile(): void {
		rmSync(this.pidFilePath(), { force: true });
	}
}
