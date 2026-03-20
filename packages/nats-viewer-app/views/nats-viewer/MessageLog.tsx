'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/os-primitives/empty-state';
import type { LogEntry } from './types';

// ---------------------------------------------------------------------------
// Hash-to-color for subject segments
// ---------------------------------------------------------------------------

const SUBJECT_COLORS = [
	'text-blue-400',
	'text-green-400',
	'text-amber-400',
	'text-purple-400',
	'text-pink-400',
	'text-cyan-400',
	'text-orange-400',
	'text-teal-400',
	'text-red-400',
	'text-indigo-400',
];

function hashColor(segment: string): string {
	let hash = 0;
	for (let i = 0; i < segment.length; i++) {
		hash = (hash * 31 + segment.charCodeAt(i)) | 0;
	}
	return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

function subjectColor(subject: string): string {
	// Color by first segment after "os."
	const parts = subject.split('.');
	const key = parts.length > 1 ? parts[1] : parts[0];
	return hashColor(key);
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
	const d = new Date(ts);
	const h = String(d.getHours()).padStart(2, '0');
	const m = String(d.getMinutes()).padStart(2, '0');
	const s = String(d.getSeconds()).padStart(2, '0');
	const ms = String(d.getMilliseconds()).padStart(3, '0');
	return `${h}:${m}:${s}.${ms}`;
}

// ---------------------------------------------------------------------------
// Base64 detection and decoding
// ---------------------------------------------------------------------------

const BASE64_RE = /^[A-Za-z0-9+/]{4,}={0,2}$/;

function isBase64(value: string): boolean {
	if (value.length < 4) return false;
	return BASE64_RE.test(value.trim());
}

function tryDecodeBase64(value: string): string | null {
	try {
		const decoded = atob(value.trim());
		// Check if the decoded result is valid UTF-8 text (printable)
		const isPrintable = /^[\x20-\x7E\t\n\r]+$/.test(decoded);
		return isPrintable ? decoded : null;
	} catch {
		return null;
	}
}

function decodeBase64InPayload(payload: unknown): unknown {
	if (typeof payload === 'string' && isBase64(payload)) {
		const decoded = tryDecodeBase64(payload);
		return decoded !== null ? decoded : payload;
	}
	if (Array.isArray(payload)) {
		return payload.map(decodeBase64InPayload);
	}
	if (payload !== null && typeof payload === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(payload)) {
			result[key] = decodeBase64InPayload(value);
		}
		return result;
	}
	return payload;
}

// ---------------------------------------------------------------------------
// Payload truncation
// ---------------------------------------------------------------------------

function truncatePayload(payload: unknown, maxLen = 120): string {
	try {
		const str = JSON.stringify(payload);
		return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str;
	} catch {
		return String(payload);
	}
}

// ---------------------------------------------------------------------------
// MessageRow
// ---------------------------------------------------------------------------

function MessageRow({ entry, index }: { entry: LogEntry; index: number }) {
	const [expanded, setExpanded] = useState(false);
	const [decodeBase64, setDecodeBase64] = useState(false);

	const displayPayload = decodeBase64 ? decodeBase64InPayload(entry.payload) : entry.payload;

	return (
		<div>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className={`flex w-full items-baseline gap-2 px-2 py-0.5 text-left text-[11px] leading-5 transition-colors hover:bg-gray-alpha-200 ${
					index % 2 === 0 ? 'bg-transparent' : 'bg-gray-alpha-50'
				}`}
			>
				{/* Timestamp */}
				<span className="shrink-0 font-mono text-gray-700">{formatTimestamp(entry.timestamp)}</span>

				{/* Direction arrow */}
				<span className={`shrink-0 font-mono ${entry.direction === 'in' ? 'text-green-500' : 'text-blue-500'}`}>
					{entry.direction === 'in' ? '\u2190' : '\u2192'}
				</span>

				{/* Subject */}
				<span className={`shrink-0 font-mono font-medium ${subjectColor(entry.subject)}`}>{entry.subject}</span>

				{/* Payload preview */}
				<span className="min-w-0 truncate font-mono text-gray-600">{truncatePayload(entry.payload)}</span>
			</button>

			{/* Expanded detail */}
			{expanded && (
				<div className="mx-2 mb-1 rounded border border-gray-alpha-200 bg-gray-alpha-50 p-2">
					<div className="mb-1 flex items-center gap-2">
						<button
							type="button"
							onClick={() => setDecodeBase64(!decodeBase64)}
							className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
								decodeBase64 ? 'bg-blue-600 text-white' : 'bg-gray-alpha-200 text-gray-800 hover:bg-gray-alpha-300'
							}`}
						>
							Decode Base64
						</button>
					</div>
					<pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-4 text-gray-1000">
						{JSON.stringify(displayPayload, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// MessageLog
// ---------------------------------------------------------------------------

interface MessageLogProps {
	entries: LogEntry[];
	filter: string;
	paused: boolean;
}

export function MessageLog({ entries, filter, paused }: MessageLogProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const wasAtBottomRef = useRef(true);
	const prevEntryCountRef = useRef(0);

	// Filter entries
	const filtered = useMemo(() => {
		if (!filter) return entries;
		const lower = filter.toLowerCase();
		return entries.filter((e) => {
			if (e.subject.toLowerCase().includes(lower)) return true;
			try {
				const payloadStr = JSON.stringify(e.payload).toLowerCase();
				return payloadStr.includes(lower);
			} catch {
				return false;
			}
		});
	}, [entries, filter]);

	// Track scroll position to know if we're at the bottom
	const handleScroll = () => {
		const el = containerRef.current;
		if (!el) return;
		const threshold = 30;
		wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
	};

	// Auto-scroll when new entries arrive and not paused
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const hasNewEntries = filtered.length > prevEntryCountRef.current;
		prevEntryCountRef.current = filtered.length;

		if (!paused && hasNewEntries && wasAtBottomRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [filtered.length, paused]);

	// When unpausing, scroll to bottom
	useEffect(() => {
		if (!paused) {
			const el = containerRef.current;
			if (el) {
				el.scrollTop = el.scrollHeight;
				wasAtBottomRef.current = true;
			}
		}
	}, [paused]);

	if (filtered.length === 0 && !filter) {
		return (
			<div className="flex h-full items-center justify-center">
				<EmptyState title="No messages yet" description="Subscribe to a NATS subject to start seeing messages." />
			</div>
		);
	}

	if (filtered.length === 0 && filter) {
		return (
			<div className="flex h-full items-center justify-center">
				<EmptyState title="No matching messages" description={`No entries match "${filter}".`} />
			</div>
		);
	}

	return (
		<div ref={containerRef} className="h-full overflow-auto" onScroll={handleScroll}>
			{filtered.map((entry, i) => (
				<MessageRow key={entry.id} entry={entry} index={i} />
			))}
		</div>
	);
}
