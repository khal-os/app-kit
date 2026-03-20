'use client';

import { X } from 'lucide-react';
import { useNatsViewer } from './nats-viewer-context';

export function ActiveSubs() {
	const { subscriptions, removeSubscription } = useNatsViewer();
	const subjects = Array.from(subscriptions).sort();

	if (subjects.length === 0) {
		return <p className="px-1 text-[11px] italic text-gray-700">No active subscriptions</p>;
	}

	return (
		<div className="flex flex-col gap-0.5">
			{subjects.map((subject) => (
				<div
					key={subject}
					className="group flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-alpha-100"
				>
					<span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
					<span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-900">{subject}</span>
					<button
						onClick={() => removeSubscription(subject)}
						className="shrink-0 rounded p-0.5 text-gray-600 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
						aria-label={`Unsubscribe from ${subject}`}
					>
						<X className="h-3 w-3" />
					</button>
				</div>
			))}
		</div>
	);
}
