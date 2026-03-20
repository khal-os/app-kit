/**
 * JetStream stream provisioning for observability data.
 *
 * Creates ring buffer streams for logs, events, and traces on startup.
 * Idempotent — safe to call on every service-loader boot.
 */

import { DiscardPolicy, jetstreamManager, RetentionPolicy, StorageType } from '@nats-io/jetstream';
import { type NatsConnection } from '@nats-io/transport-node';

// ── Stream names ────────────────────────────────────────────────────
export const O11Y_STREAM_LOGS = 'OS_O11Y_LOGS';
export const O11Y_STREAM_EVENTS = 'OS_O11Y_EVENTS';
export const O11Y_STREAM_TRACES = 'OS_O11Y_TRACES';

// ── Subject prefixes ────────────────────────────────────────────────
export const O11Y_SUBJECT_LOGS = 'os.o11y.logs.>';
export const O11Y_SUBJECT_EVENTS = 'os.o11y.events.>';
export const O11Y_SUBJECT_TRACES = 'os.o11y.traces.>';

const MB = 1024 * 1024;

interface StreamDef {
	name: string;
	subjects: string[];
	max_bytes: number;
}

const STREAMS: StreamDef[] = [
	{ name: O11Y_STREAM_LOGS, subjects: [O11Y_SUBJECT_LOGS], max_bytes: 20 * MB },
	{ name: O11Y_STREAM_EVENTS, subjects: [O11Y_SUBJECT_EVENTS], max_bytes: 10 * MB },
	{ name: O11Y_STREAM_TRACES, subjects: [O11Y_SUBJECT_TRACES], max_bytes: 5 * MB },
];

/**
 * Ensure all observability JetStream streams exist with the correct config.
 * Creates streams that don't exist; updates streams whose config has drifted.
 */
export async function ensureO11yStreams(nc: NatsConnection): Promise<void> {
	const jsm = await jetstreamManager(nc);

	for (const def of STREAMS) {
		try {
			const info = await jsm.streams.info(def.name);

			// Check if config needs updating
			const cfg = info.config;
			if (
				cfg.max_bytes !== def.max_bytes ||
				cfg.retention !== RetentionPolicy.Limits ||
				JSON.stringify(cfg.subjects) !== JSON.stringify(def.subjects)
			) {
				await jsm.streams.update(def.name, {
					subjects: def.subjects,
					max_bytes: def.max_bytes,
				});
				console.log(`[o11y] updated stream ${def.name}`);
			}
		} catch (err: unknown) {
			// Stream doesn't exist — create it
			if (isStreamNotFound(err)) {
				await jsm.streams.add({
					name: def.name,
					subjects: def.subjects,
					retention: RetentionPolicy.Limits,
					storage: StorageType.File,
					max_bytes: def.max_bytes,
					discard: DiscardPolicy.Old,
				});
				console.log(`[o11y] created stream ${def.name} (max ${def.max_bytes / MB}MB)`);
			} else {
				throw err;
			}
		}
	}
}

function isStreamNotFound(err: unknown): boolean {
	if (err && typeof err === 'object') {
		// JetStreamApiError has a code property; 404 = stream not found
		if ('code' in err && (err as { code: number }).code === 404) return true;
		// Fallback: check message
		if ('message' in err && typeof (err as { message: string }).message === 'string') {
			return (err as { message: string }).message.includes('stream not found');
		}
	}
	return false;
}
