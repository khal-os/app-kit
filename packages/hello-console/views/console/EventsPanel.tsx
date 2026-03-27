'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { EventEntry } from './types';

interface EventsPanelProps {
	events: EventEntry[];
	connected: boolean;
}

const EVENT_TYPE_COLORS: Record<string, 'teal' | 'green' | 'amber' | 'blue' | 'red' | 'gray'> = {
	user_speech: 'teal',
	agent_spoke: 'green',
	tool_call: 'amber',
	call_state: 'blue',
	interruption: 'red',
	vad: 'gray',
};

export function EventsPanel({ events, connected }: EventsPanelProps) {
	const [filter, setFilter] = useState('');
	const scrollRef = useRef<HTMLDivElement>(null);
	const isScrolledToBottom = useRef(true);

	const filtered = filter
		? events.filter(
				(e) =>
					e.type.toLowerCase().includes(filter.toLowerCase()) || e.message.toLowerCase().includes(filter.toLowerCase())
			)
		: events;

	const handleScroll = () => {
		if (!scrollRef.current) return;
		const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
		isScrolledToBottom.current = Math.ceil(scrollHeight - scrollTop) <= Math.ceil(clientHeight) + 4;
	};

	useEffect(() => {
		if (!scrollRef.current || !isScrolledToBottom.current) return;
		scrollRef.current.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: 'smooth',
		});
	}, [filtered]);

	if (!connected) {
		return (
			<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">
				Connect to an agent to view events
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b border-gray-alpha-200 px-3 py-1.5">
				<span className="text-label-13 font-medium text-gray-800">Events</span>
				<Badge variant="gray" size="sm">
					{events.length}
				</Badge>
				<div className="ml-auto w-40">
					<Input
						size="small"
						placeholder="Filter events..."
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
					/>
				</div>
			</div>

			<div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto font-mono">
				{filtered.length === 0 ? (
					<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">
						{events.length === 0 ? 'No events yet' : 'No matching events'}
					</div>
				) : (
					<div className="divide-y divide-gray-alpha-100">
						{filtered.map((event) => (
							<div
								key={event.id}
								className="grid grid-cols-[100px_120px_1fr] items-center gap-2 px-3 py-1 text-copy-13"
							>
								<span className="text-gray-400">{formatTime(event.timestamp)}</span>
								<Badge variant={EVENT_TYPE_COLORS[event.type] ?? 'gray'} size="sm">
									{event.type}
								</Badge>
								<span className="truncate text-gray-700">{event.message}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function formatTime(timestamp: string): string {
	try {
		const d = new Date(timestamp);
		return d.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3,
		} as Intl.DateTimeFormatOptions);
	} catch {
		return '';
	}
}
