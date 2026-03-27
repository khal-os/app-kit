'use client';

import { CheckCircle, ChevronRight, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import type { FunctionCallEntry } from './types';

interface FunctionCallPanelProps {
	functionCalls: FunctionCallEntry[];
	connected: boolean;
}

export function FunctionCallPanel({ functionCalls, connected }: FunctionCallPanelProps) {
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
	}, [functionCalls]);

	if (!connected) {
		return (
			<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">
				Connect to an agent to view function calls
			</div>
		);
	}

	if (functionCalls.length === 0) {
		return <div className="flex h-full items-center justify-center text-copy-13 text-gray-500">No function calls</div>;
	}

	return (
		<div ref={scrollRef} onScroll={handleScroll} className="flex h-full flex-col gap-1 overflow-y-auto p-2">
			{functionCalls.map((fc) => (
				<FunctionCallItem key={fc.id} entry={fc} />
			))}
		</div>
	);
}

function FunctionCallItem({ entry }: { entry: FunctionCallEntry }) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="rounded-md border border-gray-alpha-200">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-alpha-50"
			>
				<ChevronRight className={`h-3 w-3 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
				<StatusIcon status={entry.status} />
				<span className="font-mono text-copy-13 font-medium text-gray-1000">{entry.name}</span>
				<span className="ml-auto text-copy-13 text-gray-400">{formatTime(entry.timestamp)}</span>
			</button>

			{isOpen && (
				<div className="border-t border-gray-alpha-200 px-3 py-2">
					<div className="mb-2">
						<span className="mb-1 block text-label-13 font-medium text-gray-600">Arguments</span>
						<pre className="overflow-x-auto rounded bg-background-200 p-2 font-mono text-copy-13 text-gray-800">
							{JSON.stringify(entry.args, null, 2)}
						</pre>
					</div>
					{entry.result !== null && (
						<div>
							<span className="mb-1 block text-label-13 font-medium text-gray-600">Result</span>
							<pre className="overflow-x-auto rounded bg-background-200 p-2 font-mono text-copy-13 text-gray-800">
								{JSON.stringify(entry.result, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function StatusIcon({ status }: { status: FunctionCallEntry['status'] }) {
	switch (status) {
		case 'in_progress':
			return <Spinner size="sm" />;
		case 'completed':
			return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
		case 'error':
			return <XCircle className="h-3.5 w-3.5 text-red-500" />;
	}
}

function formatTime(timestamp: string): string {
	try {
		return new Date(timestamp).toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	} catch {
		return '';
	}
}
