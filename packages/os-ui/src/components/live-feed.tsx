'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../utils';

type FeedEventType = 'info' | 'success' | 'warning' | 'error' | 'agent' | 'system';

interface FeedEvent {
	id: string;
	type: FeedEventType;
	message: string;
	timestamp?: Date;
}

const typeColors: Record<FeedEventType, string> = {
	info: 'var(--ds-blue-600)',
	success: 'var(--ds-green-600)',
	warning: 'var(--ds-amber-600)',
	error: 'var(--ds-red-600)',
	agent: 'var(--ds-purple-600)',
	system: 'var(--ds-gray-600)',
};

interface LiveFeedProps {
	/** Initial events to render */
	events?: FeedEvent[];
	/** Maximum visible events before oldest are removed */
	maxVisible?: number;
	/** Show timestamps next to events */
	showTimestamps?: boolean;
	/** Height of the feed container */
	height?: number | string;
	className?: string;
}

function LiveFeed({
	events: externalEvents,
	maxVisible = 50,
	showTimestamps = true,
	height = 300,
	className,
}: LiveFeedProps) {
	const [events, setEvents] = useState<FeedEvent[]>(externalEvents ?? []);
	const scrollRef = useRef<HTMLDivElement>(null);
	const isAtBottom = useRef(true);

	// Sync external events
	useEffect(() => {
		if (externalEvents) {
			setEvents((prev) => {
				const combined = [...prev, ...externalEvents.filter((e) => !prev.some((p) => p.id === e.id))];
				return combined.slice(-maxVisible);
			});
		}
	}, [externalEvents, maxVisible]);

	// Auto-scroll to bottom when new events arrive and user is at bottom
	useEffect(() => {
		const el = scrollRef.current;
		if (el && isAtBottom.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [events]);

	const handleScroll = useCallback(() => {
		const el = scrollRef.current;
		if (el) {
			isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
		}
	}, []);

	const formatTime = (d: Date) =>
		d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

	return (
		<div
			ref={scrollRef}
			onScroll={handleScroll}
			className={cn('overflow-y-auto overflow-x-hidden font-mono text-xs leading-5 scrollbar-thin', className)}
			style={{ height }}
		>
			<AnimatePresence initial={false}>
				{events.map((event) => (
					<motion.div
						key={event.id}
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
						className="flex gap-2 px-2 py-0.5 hover:bg-[var(--ds-gray-alpha-100)]"
					>
						<span
							className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
							style={{ backgroundColor: typeColors[event.type] }}
						/>
						{showTimestamps && event.timestamp && (
							<span className="shrink-0 opacity-40 tabular-nums">{formatTime(event.timestamp)}</span>
						)}
						<span className="opacity-80 break-words min-w-0">{event.message}</span>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}

export type { FeedEvent, FeedEventType, LiveFeedProps };
export { LiveFeed };
