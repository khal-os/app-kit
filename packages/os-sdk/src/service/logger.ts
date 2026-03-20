import type { NatsConnection } from '@nats-io/transport-node';

export interface LogEntry {
	ts: string;
	level: 'debug' | 'info' | 'warn' | 'error';
	service: string;
	msg: string;
	error?: { message: string; stack?: string };
	trace_id?: string;
	span_id?: string;
	req_id?: string;
	meta?: Record<string, unknown>;
}

export interface Logger {
	debug(msg: string, meta?: Record<string, unknown>): void;
	info(msg: string, meta?: Record<string, unknown>): void;
	warn(msg: string, meta?: Record<string, unknown>): void;
	error(msg: string, meta?: Record<string, unknown>): void;
	child(defaultMeta: Record<string, unknown>): Logger;
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);

function writeStdout(line: string): void {
	originalStdoutWrite(`${line}\n`);
}

function applyMeta(entry: LogEntry, merged: Record<string, unknown>): void {
	if (merged.error instanceof Error) {
		entry.error = { message: merged.error.message, stack: merged.error.stack };
		const { error: _, ...rest } = merged;
		if (Object.keys(rest).length > 0) entry.meta = rest;
		return;
	}

	const rest: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(merged)) {
		if (key === 'trace_id' && value) entry.trace_id = value as string;
		else if (key === 'span_id' && value) entry.span_id = value as string;
		else if (key === 'req_id' && value) entry.req_id = value as string;
		else rest[key] = value;
	}
	if (Object.keys(rest).length > 0) entry.meta = rest;
}

function publishToNats(nc: NatsConnection | null, subject: string, json: string): void {
	if (!nc) return;
	try {
		nc.publish(subject, json);
	} catch {
		// Silently ignore publish failures
	}
}

export function createLogger(
	serviceName: string,
	nc: NatsConnection | null,
	defaultMeta?: Record<string, unknown>
): Logger {
	const subject = `os.o11y.logs.${serviceName}`;

	function emit(level: LogEntry['level'], msg: string, meta?: Record<string, unknown>): void {
		const entry: LogEntry = {
			ts: new Date().toISOString(),
			level,
			service: serviceName,
			msg,
		};

		const merged = defaultMeta ? { ...defaultMeta, ...meta } : meta;
		if (merged) applyMeta(entry, merged);

		const json = JSON.stringify(entry);
		writeStdout(json);
		publishToNats(nc, subject, json);
	}

	return {
		debug: (msg, meta) => emit('debug', msg, meta),
		info: (msg, meta) => emit('info', msg, meta),
		warn: (msg, meta) => emit('warn', msg, meta),
		error: (msg, meta) => emit('error', msg, meta),
		child(childMeta) {
			return createLogger(serviceName, nc, { ...defaultMeta, ...childMeta });
		},
	};
}
