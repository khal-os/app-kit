/**
 * Service runtime helper — abstracts NATS connect + subscribe + graceful shutdown boilerplate.
 *
 * Usage:
 *   import { createService } from '@genie-os/sdk';
 *
 *   createService({
 *     name: 'my-service',
 *     subscriptions: [
 *       { subject: 'os.myapp.foo', handler: (msg, nc) => { ... } },
 *     ],
 *     onReady: async (nc) => { console.log('ready'); },
 *     onShutdown: async () => { ... },
 *   });
 */

import type { Msg } from '@nats-io/nats-core';
import { connect, type NatsConnection } from '@nats-io/transport-node';
import { NATS_URL } from '../config';

// Re-export types so callers don't need to import from @nats-io directly.
export type { NatsConnection, Msg };

/**
 * A single NATS subject subscription with its message handler.
 */
export interface ServiceHandler {
	/** NATS subject pattern to subscribe to (wildcards supported). */
	subject: string;
	/** Called for each incoming message. Errors are caught and logged. */
	handler: (msg: Msg, nc: NatsConnection) => void | Promise<void>;
}

/**
 * Configuration for a managed NATS service.
 */
export interface ServiceConfig {
	/** Human-readable name used in log output, e.g. 'pty-service'. */
	name: string;
	/** Subscriptions to set up after connecting. */
	subscriptions?: ServiceHandler[];
	/** Called once after all subscriptions are registered. */
	onReady?: (nc: NatsConnection) => void | Promise<void>;
	/** Called during graceful shutdown before draining NATS. */
	onShutdown?: () => void | Promise<void>;
}

/**
 * Connect to NATS, register subscriptions, handle graceful shutdown, and keep the process alive.
 *
 * This function never resolves (it awaits nc.closed()), so it should be the last thing called.
 * Errors during startup cause process.exit(1) via the .catch() wrapper.
 */
export async function createService(config: ServiceConfig): Promise<void> {
	const { name, subscriptions = [], onReady, onShutdown } = config;

	const nc = await connect({ servers: NATS_URL });
	console.log(`[${name}] connected to NATS (${NATS_URL})`);

	// Register all subscriptions and spawn async iterators.
	const subs = subscriptions.map(({ subject, handler }) => {
		const sub = nc.subscribe(subject);
		console.log(`[${name}] subscribed to ${subject}`);

		(async () => {
			for await (const msg of sub) {
				try {
					await handler(msg, nc);
				} catch (err) {
					console.error(`[${name}] handler error on ${subject}:`, err);
				}
			}
		})();

		return sub;
	});

	// Notify the service that everything is wired up.
	if (onReady) {
		await onReady(nc);
	}

	// Graceful shutdown — guard against being called twice (e.g. SIGINT + SIGTERM).
	let shuttingDown = false;

	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;

		console.log(`[${name}] shutting down...`);

		for (const sub of subs) {
			sub.unsubscribe();
		}

		if (onShutdown) {
			try {
				await onShutdown();
			} catch (err) {
				console.error(`[${name}] onShutdown error:`, err);
			}
		}

		// drain() waits for in-flight messages before closing — safer than close().
		await nc.drain();
		process.exit(0);
	};

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);

	// Keep the process alive until NATS connection closes.
	await nc.closed();
}
