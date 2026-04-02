'use client';

import { SparklineChart } from './SparklineChart';
import type { MetricsState } from './types';

interface MetricsPanelProps {
	metrics: MetricsState;
	connected: boolean;
}

const getColorForProcessor = (processor: string, alpha = 1) => {
	const hash = processor.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
	const h = Math.abs(hash) % 360;
	return `hsla(${h}, 70%, 50%, ${alpha})`;
};

export function MetricsPanel({ metrics, connected }: MetricsPanelProps) {
	if (!connected) {
		return (
			<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">
				Connect to an agent to view metrics
			</div>
		);
	}

	const processors = Object.keys(metrics.ttfb);
	const hasData = processors.length > 0 || metrics.tokenUsage.total_tokens > 0 || metrics.turnCount > 0;

	if (!hasData) {
		return (
			<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">Waiting for metrics...</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
			{/* TTFB Sparklines */}
			{processors.length > 0 && (
				<div>
					<h3 className="mb-2 text-label-13 font-medium text-gray-800">TTFB by Processor</h3>
					<div className="grid grid-cols-1 gap-3">
						{processors.map((processor) => (
							<div key={processor}>
								<span className="mb-1 block text-copy-13 text-gray-600">{processor}</span>
								<SparklineChart
									data={metrics.ttfb[processor]}
									label={`${processor} TTFB`}
									color={getColorForProcessor(processor)}
									height={100}
								/>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Token Usage Counters */}
			<div>
				<h3 className="mb-2 text-label-13 font-medium text-gray-800">Token Usage</h3>
				<div className="grid grid-cols-3 gap-2">
					<CounterCard label="Prompt" value={metrics.tokenUsage.prompt_tokens} />
					<CounterCard label="Completion" value={metrics.tokenUsage.completion_tokens} />
					<CounterCard label="Total" value={metrics.tokenUsage.total_tokens} />
				</div>
			</div>

			{/* Turn Count */}
			<div>
				<h3 className="mb-2 text-label-13 font-medium text-gray-800">Turns</h3>
				<div className="flex h-16 items-center justify-center rounded-md border border-gray-alpha-200 bg-background-200">
					<span className="text-2xl font-semibold text-gray-1000">{metrics.turnCount}</span>
				</div>
			</div>
		</div>
	);
}

function CounterCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex flex-col items-center rounded-md border border-gray-alpha-200 bg-background-200 px-2 py-2">
			<span className="text-copy-13 text-gray-500">{label}</span>
			<span className="text-lg font-semibold tabular-nums text-gray-1000">{value.toLocaleString()}</span>
		</div>
	);
}
