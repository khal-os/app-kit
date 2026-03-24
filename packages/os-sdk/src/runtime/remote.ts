/**
 * RemoteRuntime — connects to an already-running KhalOS instance over HTTP.
 *
 * No local processes are managed. Health checks and info are proxied
 * to the remote server's API endpoints.
 */

import { BaseRuntime } from './base';
import type { RuntimeConfig, RuntimeHealth } from './types';

// ---------------------------------------------------------------------------
// RemoteRuntime
// ---------------------------------------------------------------------------

export class RemoteRuntime extends BaseRuntime {
	readonly type = 'remote' as const;

	private serverUrl: string;
	private startedAt: number | undefined;

	constructor(config: RuntimeConfig) {
		super(config);
		if (!config.url) {
			throw new Error('RemoteRuntime requires a url in RuntimeConfig');
		}
		// Strip trailing slash.
		this.serverUrl = config.url.replace(/\/+$/, '');
	}

	// -----------------------------------------------------------------------
	// Dependencies — nothing to download for remote
	// -----------------------------------------------------------------------

	async ensureDeps(): Promise<void> {
		// No local deps needed.
	}

	async depsReady(): Promise<boolean> {
		return true;
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	async start(): Promise<void> {
		if (this.running) return;

		// Verify the remote server is reachable.
		const healthUrl = `${this.serverUrl}/api/health`;
		let response: Response;
		try {
			response = await fetch(healthUrl);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.emit({ type: 'runtime:error', error: `Cannot reach remote server at ${healthUrl}: ${message}` });
			throw new Error(`Cannot reach remote server at ${healthUrl}: ${message}`);
		}

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			this.emit({
				type: 'runtime:error',
				error: `Remote server returned HTTP ${response.status}: ${text}`,
			});
			throw new Error(`Remote server returned HTTP ${response.status}: ${text}`);
		}

		// Optionally fetch server info.
		try {
			const infoResponse = await fetch(`${this.serverUrl}/api/server-info`);
			if (infoResponse.ok) {
				const info = await infoResponse.json();
				this.emit({
					type: 'log',
					source: 'remote',
					level: 'info',
					message: `Connected to remote KhalOS: ${JSON.stringify(info)}`,
				});
			}
		} catch {
			// Server info is optional — don't fail if it's unavailable.
		}

		this.running = true;
		this.startedAt = Date.now();
		this.emit({ type: 'runtime:ready' });
	}

	async stop(): Promise<void> {
		// Remote runtime doesn't control the server — just disconnect logically.
		this.running = false;
		this.startedAt = undefined;
		this.emit({ type: 'runtime:stopped' });
	}

	url(): string {
		return this.serverUrl;
	}

	async health(): Promise<RuntimeHealth> {
		try {
			const response = await fetch(`${this.serverUrl}/api/health`);
			if (!response.ok) {
				return {
					status: 'unhealthy',
					services: [],
					uptime: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : undefined,
				};
			}
			const data = (await response.json()) as RuntimeHealth;
			return {
				...data,
				uptime: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : undefined,
			};
		} catch {
			return {
				status: 'unhealthy',
				services: [],
				uptime: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : undefined,
			};
		}
	}
}
