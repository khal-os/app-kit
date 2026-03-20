/**
 * Distributed trace context utilities for NATS header propagation.
 *
 * Trace context is carried via NATS headers:
 *   x-trace-id    — root trace identifier (shared across all spans in a request)
 *   x-span-id     — unique identifier for this specific operation
 *   x-parent-span-id — the span that initiated this one
 */

import { randomUUID } from 'node:crypto';
import type { Msg } from '@nats-io/nats-core';
import { headers } from '@nats-io/transport-node';

export const TRACE_HEADER = 'x-trace-id';
export const SPAN_HEADER = 'x-span-id';
export const PARENT_SPAN_HEADER = 'x-parent-span-id';

export interface TraceContext {
	traceId: string;
	spanId: string;
	parentSpanId?: string;
}

/** Generate a short unique ID suitable for span/trace identifiers. */
function generateId(): string {
	return randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Extract trace context from an inbound NATS message's headers.
 * Returns whatever headers are present; missing fields are undefined.
 */
export function extractTrace(msg: Msg): Partial<TraceContext> {
	const hdrs = msg.headers;
	if (!hdrs) return {};

	return {
		traceId: hdrs.get(TRACE_HEADER) || undefined,
		spanId: hdrs.get(SPAN_HEADER) || undefined,
		parentSpanId: hdrs.get(PARENT_SPAN_HEADER) || undefined,
	};
}

/**
 * Create a new span, optionally continuing an existing trace.
 * If no traceId is provided, starts a new trace root.
 */
export function newSpan(traceId?: string): TraceContext {
	return {
		traceId: traceId || generateId(),
		spanId: generateId(),
		parentSpanId: undefined,
	};
}

/**
 * Inject trace context into NATS headers for outbound messages.
 * Creates a new MsgHdrs if none provided.
 */
export function injectTrace(
	hdrs: ReturnType<typeof headers> | null | undefined,
	ctx: TraceContext
): ReturnType<typeof headers> {
	const h = hdrs || headers();
	h.set(TRACE_HEADER, ctx.traceId);
	h.set(SPAN_HEADER, ctx.spanId);
	if (ctx.parentSpanId) {
		h.set(PARENT_SPAN_HEADER, ctx.parentSpanId);
	}
	return h;
}
