/**
 * BaseRuntime — abstract class with shared EventEmitter pattern.
 *
 * All concrete runtimes extend this. Provides on/off/emit plus
 * the default restart() implementation (stop + start).
 */

import type { Runtime, RuntimeConfig, RuntimeEvent, RuntimeEventHandler, RuntimeHealth, RuntimeType } from './types';

export abstract class BaseRuntime implements Runtime {
	abstract readonly type: RuntimeType;

	protected readonly config: RuntimeConfig;
	private handlers: Set<RuntimeEventHandler> = new Set();
	protected running = false;

	constructor(config: RuntimeConfig) {
		this.config = config;
	}

	// -----------------------------------------------------------------------
	// Event emitter
	// -----------------------------------------------------------------------

	on(handler: RuntimeEventHandler): void {
		this.handlers.add(handler);
	}

	off(handler: RuntimeEventHandler): void {
		this.handlers.delete(handler);
	}

	protected emit(event: RuntimeEvent): void {
		for (const handler of this.handlers) {
			try {
				handler(event);
			} catch {
				// Never let a listener error crash the runtime.
			}
		}
	}

	// -----------------------------------------------------------------------
	// Shared implementations
	// -----------------------------------------------------------------------

	isRunning(): boolean {
		return this.running;
	}

	async restart(): Promise<void> {
		await this.stop();
		await this.start();
	}

	// -----------------------------------------------------------------------
	// Abstract — each runtime must implement these
	// -----------------------------------------------------------------------

	abstract start(): Promise<void>;
	abstract stop(): Promise<void>;
	abstract url(): string;
	abstract health(): Promise<RuntimeHealth>;
	abstract ensureDeps(): Promise<void>;
	abstract depsReady(): Promise<boolean>;
}
