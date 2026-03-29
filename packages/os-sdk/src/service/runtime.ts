/**
 * Service runtime helper — abstracts NATS connect + subscribe + graceful shutdown boilerplate.
 *
 * Usage:
 *   import { createService } from '@khal-os/sdk';
 *
 *   createService({
 *     name: 'my-service',
 *     subscriptions: [
 *       { subject: 'os.myapp.foo', handler: (msg, nc) => { ... } },
 *     ],
 *     onReady: async (nc, log) => { log.info('ready'); },
 *     onShutdown: async () => { ... },
 *   });
 */

import type { Msg } from '@nats-io/nats-core';
import { connect, type NatsConnection } from '@nats-io/transport-node';
import { NATS_URL } from '../config';
import { interceptConsole } from './console-intercept';
import type { Logger } from './logger';
import { createLogger } from './logger';
import { extractTrace, newSpan } from './trace';

// Re-export types so callers don't need to import from @nats-io directly.
export type { Msg, NatsConnection };

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
 * Observability configuration for auto-instrumentation.
 */
export interface ObserveConfig {
	/** Additional subject patterns to exclude from auto-capture. */
	exclude?: string[];
	/** Minimum log level (default: 'info'). */
	level?: string;
}

/**
 * Configuration for a managed NATS service.
 */
export interface ServiceConfig {
	/** Human-readable name used in log output, e.g. 'pty-service'. */
	name: string;
	/** Subscriptions to set up after connecting. */
	subscriptions?: ServiceHandler[];
	/** Called once after all subscriptions are registered. Receives logger as second arg (backward compatible). */
	onReady?: (nc: NatsConnection, log: Logger) => void | Promise<void>;
	/** Called during graceful shutdown before draining NATS. */
	onShutdown?: () => void | Promise<void>;
	/** Observability config for auto-instrumentation. */
	observe?: ObserveConfig;
	/** App ID for constructing standard subjects. If set, registers AI control surface. */
	appId?: string;
}

/** Default subject patterns excluded from handler event auto-capture. */
const DEFAULT_EXCLUDE_PATTERNS = ['os.o11y.*', '*.data', '*.input', '*.resize', 'os.pty.*'];

/**
 * Check if a NATS subject matches any exclusion pattern.
 * Supports `*` as a single-token wildcard and `>` as a multi-token wildcard.
 */
function matchesExclusion(subject: string, patterns: string[]): boolean {
	for (const pattern of patterns) {
		if (matchPattern(subject, pattern)) return true;
	}
	return false;
}

function matchPattern(subject: string, pattern: string): boolean {
	const subParts = subject.split('.');
	const patParts = pattern.split('.');

	for (let i = 0; i < patParts.length; i++) {
		const pat = patParts[i];
		if (pat === '>') return true; // multi-token wildcard matches rest
		if (i >= subParts.length) return false;
		if (pat !== '*' && pat !== subParts[i]) return false;
	}

	return subParts.length === patParts.length;
}

/** Spawn the async message loop for a subscription. */
function spawnMessageLoop(
	sub: AsyncIterable<Msg>,
	shouldInstrument: boolean,
	nc: NatsConnection,
	log: Logger,
	serviceName: string,
	subject: string,
	handler: (msg: Msg, nc: NatsConnection) => void | Promise<void>
): void {
	(async () => {
		for await (const msg of sub) {
			if (shouldInstrument) {
				await instrumentedHandler(nc, log, serviceName, subject, msg, handler);
			} else {
				await plainHandler(log, subject, msg, handler, nc);
			}
		}
	})();
}

/** Handle a message without instrumentation, just error catching. */
async function plainHandler(
	log: Logger,
	subject: string,
	msg: Msg,
	handler: (msg: Msg, nc: NatsConnection) => void | Promise<void>,
	nc: NatsConnection
): Promise<void> {
	try {
		await handler(msg, nc);
	} catch (err) {
		log.error(`handler error on ${subject}`, {
			error: err instanceof Error ? err : new Error(String(err)),
		});
	}
}

/**
 * Connect to NATS, register subscriptions, handle graceful shutdown, and keep the process alive.
 *
 * This function never resolves (it awaits nc.closed()), so it should be the last thing called.
 * Errors during startup cause process.exit(1) via the .catch() wrapper.
 */
export async function createService(config: ServiceConfig): Promise<void> {
	const { name, subscriptions = [], onReady, onShutdown, observe, appId } = config;

	const nc = await connect({ servers: NATS_URL });

	// Create structured logger and intercept console for this service.
	const log = createLogger(name, nc);
	const _restoreConsole = interceptConsole(log);

	log.info(`connected to NATS (${NATS_URL})`);

	// Build merged exclusion list for auto-capture.
	const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...(observe?.exclude ?? [])];

	// Register all subscriptions and spawn async iterators.
	const subs = subscriptions.map(({ subject, handler }) => {
		const sub = nc.subscribe(subject);
		log.info(`subscribed to ${subject}`);

		const shouldInstrument = !matchesExclusion(subject, excludePatterns);
		spawnMessageLoop(sub, shouldInstrument, nc, log, name, subject, handler);

		return sub;
	});

	// AI Control Surface: auto-wire standard subjects when appId is provided
	if (appId) {
		const capSub = nc.subscribe(`khal.*.${appId}.capabilities`);
		subs.push(capSub);
		log.info(`subscribed to khal.*.${appId}.capabilities (auto)`);
		spawnMessageLoop(capSub, false, nc, log, name, `khal.*.${appId}.capabilities`, async (msg) => {
			const capabilities = {
				appId,
				service: name,
				subjects: subscriptions.map((s) => ({
					subject: s.subject,
					type: s.subject.includes('.query.') ? 'query' : s.subject.includes('.command.') ? 'command' : 'handler',
				})),
				standard: [`khal.*.${appId}.capabilities`, `khal.*.${appId}.health`, `khal.*.${appId}.events.>`],
			};
			if (msg.reply) {
				msg.respond(JSON.stringify(capabilities));
			}
		});

		const appHealthSub = nc.subscribe(`khal.*.${appId}.health`);
		subs.push(appHealthSub);
		log.info(`subscribed to khal.*.${appId}.health (auto)`);
		spawnMessageLoop(appHealthSub, false, nc, log, name, `khal.*.${appId}.health`, async (msg) => {
			if (msg.reply) {
				msg.respond(
					JSON.stringify({
						appId,
						service: name,
						status: 'healthy',
						uptime: process.uptime(),
						ts: new Date().toISOString(),
					})
				);
			}
		});
	}

	// Notify the service that everything is wired up.
	if (onReady) {
		await onReady(nc, log);
	}

	// Graceful shutdown — guard against being called twice (e.g. SIGINT + SIGTERM).
	let shuttingDown = false;

	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;

		log.info('shutting down...');

		for (const sub of subs) {
			sub.unsubscribe();
		}

		if (onShutdown) {
			try {
				await onShutdown();
			} catch (err) {
				log.error('onShutdown error', {
					error: err instanceof Error ? err : new Error(String(err)),
				});
			}
		}

		_restoreConsole();

		// drain() waits for in-flight messages before closing — safer than close().
		await nc.drain();
		process.exit(0);
	};

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);

	// Keep the process alive until NATS connection closes.
	await nc.closed();
}

/**
 * Wraps a handler invocation with observability: trace extraction, timing, and event emission.
 */
async function instrumentedHandler(
	nc: NatsConnection,
	log: Logger,
	serviceName: string,
	subject: string,
	msg: Msg,
	handler: (msg: Msg, nc: NatsConnection) => void | Promise<void>
): Promise<void> {
	// Extract or generate trace context.
	const inbound = extractTrace(msg);
	const span = newSpan(inbound.traceId);
	if (inbound.spanId) {
		span.parentSpanId = inbound.spanId;
	}

	const payloadBytes = msg.data?.length ?? 0;
	const start = performance.now();
	let error: { message: string; stack?: string } | undefined;

	try {
		await handler(msg, nc);
	} catch (err) {
		const e = err instanceof Error ? err : new Error(String(err));
		error = { message: e.message, stack: e.stack };
		log.error(`handler error on ${subject}`, {
			error: e,
			trace_id: span.traceId,
			span_id: span.spanId,
		});
	}

	const durationMs = Math.round((performance.now() - start) * 100) / 100;

	// Emit observability event (fire-and-forget).
	const event = {
		subject,
		service: serviceName,
		duration_ms: durationMs,
		payload_bytes: payloadBytes,
		trace_id: span.traceId,
		span_id: span.spanId,
		parent_span_id: span.parentSpanId,
		ts: new Date().toISOString(),
		...(error ? { error } : {}),
	};

	// Publish to subject-domain stream: os.o11y.events.<original-subject>
	const eventSubject = `os.o11y.events.${subject}`;
	try {
		nc.publish(eventSubject, JSON.stringify(event));
	} catch {
		// Never let observability failures affect service operation.
	}
}

/**
 * Create an event publisher for AI-accessible app events.
 * Published to khal.{orgId}.{appId}.events.{eventType}
 */
export function createEventPublisher(nc: NatsConnection, appId: string) {
	return (orgId: string, eventType: string, data: unknown) => {
		nc.publish(
			`khal.${orgId}.${appId}.events.${eventType}`,
			JSON.stringify({ ts: new Date().toISOString(), type: eventType, data })
		);
	};
}
