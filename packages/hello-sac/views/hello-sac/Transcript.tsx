'use client';

import { AlertTriangle, Bot, Info, MessageSquare, User, Wrench } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../../lib/types';

interface TranscriptProps {
	entries: TranscriptEntry[];
	callStartTime: number | null;
}

const TYPE_STYLES: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
	user: {
		color: 'text-cyan-400',
		bg: 'bg-cyan-400/10',
		icon: <User className="h-3.5 w-3.5" />,
	},
	agent: {
		color: 'text-green-400',
		bg: 'bg-green-400/10',
		icon: <Bot className="h-3.5 w-3.5" />,
	},
	tool: {
		color: 'text-yellow-400',
		bg: 'bg-yellow-400/10',
		icon: <Wrench className="h-3.5 w-3.5" />,
	},
	state: {
		color: 'text-gray-500',
		bg: 'bg-transparent',
		icon: <Info className="h-3.5 w-3.5" />,
	},
	interruption: {
		color: 'text-red-400',
		bg: 'bg-red-400/10',
		icon: <AlertTriangle className="h-3.5 w-3.5" />,
	},
};

function formatRelativeTime(timestamp: string, callStart: number | null): string {
	if (!callStart) return '';
	const entryTime = new Date(timestamp).getTime();
	const elapsed = Math.max(0, Math.floor((entryTime - callStart) / 1000));
	const m = Math.floor(elapsed / 60);
	const s = elapsed % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Transcript({ entries, callStartTime }: TranscriptProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const autoScrollRef = useRef(true);

	// Track user scroll to pause/resume auto-scroll
	const handleScroll = () => {
		const el = containerRef.current;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
		autoScrollRef.current = atBottom;
	};

	// Auto-scroll on new entries
	useEffect(() => {
		if (autoScrollRef.current && containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight;
		}
	}, [entries]);

	if (entries.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-gray-500">
				<div className="flex flex-col items-center gap-2">
					<MessageSquare className="h-8 w-8 opacity-30" />
					<span className="text-sm">Waiting for call...</span>
				</div>
			</div>
		);
	}

	return (
		<div ref={containerRef} className="h-full overflow-y-auto p-3 scrollbar-thin" onScroll={handleScroll}>
			<div className="flex flex-col gap-1">
				{entries.map((entry) => {
					const style = TYPE_STYLES[entry.type] ?? TYPE_STYLES.state;
					return (
						<div
							key={entry.id}
							className={`flex items-start gap-2 rounded px-2 py-1 ${style.bg} ${entry.type === 'interruption' ? 'line-through opacity-70' : ''}`}
						>
							{/* Timestamp */}
							<span className="mt-0.5 shrink-0 font-mono text-[10px] text-gray-600">
								{formatRelativeTime(entry.timestamp, callStartTime)}
							</span>

							{/* Icon gutter */}
							<span className={`mt-0.5 shrink-0 ${style.color}`}>{style.icon}</span>

							{/* Text content */}
							<span className={`flex-1 text-sm ${style.color} ${entry.type === 'state' ? 'italic' : ''}`}>
								{entry.text}
								{entry.isPartial && <span className="ml-1 inline-block animate-pulse text-gray-500">|</span>}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
