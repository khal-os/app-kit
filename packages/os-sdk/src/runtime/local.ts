/**
 * LocalRuntime — runs KhalOS services as local child processes.
 *
 * Manages: NATS server, service-loader, ws-bridge, Next.js dev server.
 * Downloads NATS binary via deps.ts if not cached.
 * Uses Node.js child_process, net, fs, os — server-side only.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
 * Ensure a TCP port is free. If something is listening, kill it and wait.
 */
function ensurePortFree(port: number, host = '127.0.0.1'): Promise<void> {
	return new Promise((resolve, reject) => {
		const socket = createConnection({ port, host });
		socket.once('connect', () => {
			socket.destroy();
			// Port in use — try to kill whatever is on it
			try {
				const pids = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: 'utf8' }).trim();
				if (pids) {
					for (const pid of pids.split('\n')) {
						try {
							process.kill(Number(pid), 'SIGKILL');
						} catch {
							/* already dead */
						}
					}
				}
			} catch {
				/* lsof failed — no PIDs found */
			}

			// Wait for port to actually free up
			let attempts = 0;
			const check = () => {
				if (attempts++ > 20) {
					reject(new Error(`Port ${port} still in use after killing occupants.`));
					return;
				}
				const s = createConnection({ port, host });
				s.once('connect', () => {
					s.destroy();
					setTimeout(check, 200);
				}); // still occupied
				s.once('error', () => {
					s.destroy();
					resolve();
				}); // freed
			};
			setTimeout(check, 500);
		});
		socket.once('error', () => {
			socket.destroy();
			resolve(); // Connection refused = port is free
		});
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

		// Kill stale runtime from a previous run (if PID file exists)
		this.killStalePid();

		// Pre-flight: ensure critical ports are free before spawning
		const port = this.config.port ?? NEXT_PORT;
		await ensurePortFree(port);
		await ensurePortFree(NATS_PORT);
		await ensurePortFree(WS_BRIDGE_PORT);

		await this.ensureDeps();
		this.writePidFile();

		const env = {
			...process.env,
			...this.config.env,
			OS_SECRET: this.config.env?.OS_SECRET ?? generateSecret(),
			NEXT_PUBLIC_KHAL_MODE: 'local',
			KHAL_INSTANCE_ID: this.config.env?.KHAL_INSTANCE_ID ?? 'default',
			NEXT_PUBLIC_KHAL_INSTANCE_ID: this.config.env?.KHAL_INSTANCE_ID ?? 'default',
			NEXT_PUBLIC_WS_URL: 'ws://localhost:4280/ws/nats',
		};

		const projectRoot = this.config.projectRoot;

		// 1. NATS server
		this.spawnChild('nats', this.natsBin, ['--port', String(NATS_PORT), '--jetstream'], {
			cwd: projectRoot,
			env,
			port: NATS_PORT,
		});
		await waitForPort(NATS_PORT);

		// Use node_modules/.bin if available (dev), fall back to npx (release .app bundle)
		const tsxDirect = join(projectRoot, 'node_modules/.bin/tsx');
		const nextDirect = join(projectRoot, 'node_modules/.bin/next');
		const tsxBin = existsSync(tsxDirect) ? tsxDirect : 'npx';
		const nextBin = existsSync(nextDirect) ? nextDirect : 'npx';

		// Helper: prepend command name when using npx fallback
		const tsxArgs = (args: string[]) => (tsxBin === 'npx' ? ['tsx', ...args] : args);
		const nextArgs = (args: string[]) => (nextBin === 'npx' ? ['next', ...args] : args);

		// 2. Service loader (discovers and runs KhalOS services)
		this.spawnChild('services', tsxBin, tsxArgs(['src/lib/service-loader.ts']), {
			cwd: projectRoot,
			env,
		});

		// 3. WebSocket bridge (NATS <-> browser)
		this.spawnChild('ws-bridge', tsxBin, tsxArgs(['src/lib/ws-server.ts']), {
			cwd: projectRoot,
			env,
			port: WS_BRIDGE_PORT,
		});

		// 4. Next.js dev server
		this.spawnChild('next', nextBin, nextArgs(['dev', '--port', String(port)]), {
			cwd: projectRoot,
			env,
			port,
		});

		// Wait for Next.js to be ready.
		await waitForPort(port);

		this.running = true;
		this.startedAt = Date.now();

		// Safety net: kill all children if this process exits unexpectedly
		const emergencyCleanup = () => {
			for (const child of this.children) {
				if (child.process.pid && !child.process.killed) {
					try {
						child.process.kill('SIGKILL');
					} catch {
						/* already dead */
					}
				}
			}
		};
		process.once('exit', emergencyCleanup);
		process.once('SIGTERM', emergencyCleanup);
		process.once('SIGINT', emergencyCleanup);

		this.emit({ type: 'runtime:ready' });
	}

	async stop(): Promise<void> {
		if (!this.running) return;

		this.running = false;

		// SIGTERM all children directly (they share our process group).
		for (const child of this.children) {
			this.emit({ type: 'service:stopped', name: child.name });
			if (child.process.pid && !child.process.killed) {
				try {
					child.process.kill('SIGTERM');
				} catch {
					/* already dead */
				}
			}
		}

		// Wait up to STOP_TIMEOUT_MS for clean exit, then SIGKILL.
		await Promise.all(
			this.children.map(
				(child) =>
					new Promise<void>((resolve) => {
						const timer = setTimeout(() => {
							if (child.process.pid && !child.process.killed) {
								try {
									child.process.kill('SIGKILL');
								} catch {
									/* already dead */
								}
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

	/**
	 * Kill a stale runtime process from a previous run using the PID file.
	 * Best-effort: if the PID is gone or the file is missing, we silently continue.
	 */
	private killStalePid(): void {
		const pidFile = this.pidFilePath();
		if (!existsSync(pidFile)) return;

		try {
			const oldPid = Number.parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
			if (!Number.isNaN(oldPid) && oldPid > 0 && oldPid !== process.pid) {
				process.kill(oldPid, 'SIGTERM');
				// Brief synchronous wait for the old process tree to wind down
				const deadline = Date.now() + 2_000;
				while (Date.now() < deadline) {
					try {
						process.kill(oldPid, 0); // Probe: throws if process is gone
						// Still alive, spin-wait
						const waitUntil = Date.now() + 100;
						while (Date.now() < waitUntil) {
							/* busy wait */
						}
					} catch {
						break; // Process is gone
					}
				}
			}
		} catch {
			// Process already dead or permission error — either way, continue.
		}

		rmSync(pidFile, { force: true });
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
