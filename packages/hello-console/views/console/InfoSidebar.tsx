'use client';

import { Activity, LineChart, Wrench } from 'lucide-react';
import { useState } from 'react';
import { AudioWaveformPanel } from './AudioWaveformPanel';
import { FunctionCallPanel } from './FunctionCallPanel';
import { MetricsPanel } from './MetricsPanel';
import type { FunctionCallEntry, MetricsState } from './types';

type Tab = 'metrics' | 'audio' | 'functions';

interface InfoSidebarProps {
	metrics: MetricsState;
	speaking: boolean;
	functionCalls: FunctionCallEntry[];
	connected: boolean;
}

const tabs: { id: Tab; label: string; icon: typeof LineChart }[] = [
	{ id: 'metrics', label: 'Metrics', icon: LineChart },
	{ id: 'audio', label: 'Audio', icon: Activity },
	{ id: 'functions', label: 'Functions', icon: Wrench },
];

export function InfoSidebar({ metrics, speaking, functionCalls, connected }: InfoSidebarProps) {
	const [activeTab, setActiveTab] = useState<Tab>('metrics');

	return (
		<div className="flex h-full flex-col">
			<div className="flex border-b border-gray-alpha-200">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-copy-13 transition-colors ${
								activeTab === tab.id
									? 'border-b-2 border-gray-1000 font-medium text-gray-1000'
									: 'text-gray-500 hover:text-gray-700'
							}`}
						>
							<Icon className="h-3 w-3" />
							<span>{tab.label}</span>
						</button>
					);
				})}
			</div>

			<div className="flex-1 overflow-hidden">
				{activeTab === 'metrics' && <MetricsPanel metrics={metrics} connected={connected} />}
				{activeTab === 'audio' && <AudioWaveformPanel speaking={speaking} connected={connected} />}
				{activeTab === 'functions' && <FunctionCallPanel functionCalls={functionCalls} connected={connected} />}
			</div>
		</div>
	);
}
