'use client';

import { Radio } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ActiveSubs } from './ActiveSubs';
import { useNatsViewer } from './nats-viewer-context';
import { SubjectCatalog } from './SubjectCatalog';
import { SubscribeInput } from './SubscribeInput';

export function Sidebar() {
	const { subscriptions, addSubscription, removeSubscription } = useNatsViewer();
	const catchAll = 'os.>';
	const catchAllActive = subscriptions.has(catchAll);

	const toggleCatchAll = () => {
		if (catchAllActive) {
			removeSubscription(catchAll);
		} else {
			addSubscription(catchAll);
		}
	};

	return (
		<div className="flex flex-col gap-3 overflow-y-auto">
			{/* Catch-all toggle */}
			<button
				onClick={toggleCatchAll}
				className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
					catchAllActive
						? 'bg-green-500/15 text-green-700 hover:bg-green-500/25'
						: 'bg-gray-alpha-100 text-gray-900 hover:bg-gray-alpha-200'
				}`}
			>
				<Radio className="h-3.5 w-3.5" />
				<span className="font-mono">{catchAll}</span>
				<span className="ml-auto text-[11px]">{catchAllActive ? 'ON' : 'OFF'}</span>
			</button>

			{/* Custom subscribe input */}
			<SubscribeInput />

			<Separator />

			{/* Known Subjects */}
			<div>
				<h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-700">Known Subjects</h3>
				<SubjectCatalog />
			</div>

			<Separator />

			{/* Active Subscriptions */}
			<div>
				<h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-700">Active Subscriptions</h3>
				<ActiveSubs />
			</div>
		</div>
	);
}
