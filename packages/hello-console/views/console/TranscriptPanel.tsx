'use client';

import { Bot, User } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from './types';

interface TranscriptPanelProps {
	transcript: TranscriptEntry[];
	connected: boolean;
}

export function TranscriptPanel({ transcript, connected }: TranscriptPanelProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const isScrolledToBottom = useRef(true);

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
	}, [transcript]);

	if (!connected) {
		return (
			<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">Not monitoring any agent</div>
		);
	}

	if (transcript.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">Waiting for speech...</div>
		);
	}

	return (
		<div ref={scrollRef} onScroll={handleScroll} className="flex h-full flex-col gap-2 overflow-y-auto p-3">
			{transcript.map((entry) => (
				<div key={entry.id} className="flex gap-2">
					<div className="mt-0.5 shrink-0">
						{entry.role === 'user' ? (
							<User className="h-4 w-4 text-cyan-500" />
						) : (
							<Bot className="h-4 w-4 text-green-500" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<div className="mb-0.5 flex items-baseline gap-2">
							<span
								className={`text-label-13 font-medium ${entry.role === 'user' ? 'text-cyan-500' : 'text-green-500'}`}
							>
								{entry.role === 'user' ? 'User' : 'Agent'}
							</span>
							<span className="text-copy-13 text-gray-400">{formatTime(entry.timestamp)}</span>
						</div>
						<div className="text-copy-13 text-gray-900">
							{entry.isPartial ? <KaraokeText text={entry.text} /> : entry.text}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

function KaraokeText({ text }: { text: string }) {
	const words = text.split(' ');
	if (words.length === 0) return null;

	const leading = words.slice(0, -1).join(' ');
	const lastWord = words[words.length - 1];

	return (
		<span>
			{leading && <span>{leading} </span>}
			<span className="animate-pulse opacity-70">{lastWord}</span>
		</span>
	);
}

function formatTime(timestamp: string): string {
	try {
		const d = new Date(timestamp);
		return d.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	} catch {
		return '';
	}
}
