'use client';

import {
	CategoryScale,
	Chart as ChartJS,
	type ChartOptions,
	Legend,
	LinearScale,
	LineElement,
	PointElement,
	Title,
	Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { MetricDataPoint } from './types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SparklineChartProps {
	data: MetricDataPoint[];
	label: string;
	color: string;
	height?: number;
}

const sparklineOptions: ChartOptions<'line'> = {
	responsive: true,
	maintainAspectRatio: false,
	animation: { duration: 200 },
	plugins: {
		legend: { display: false },
		tooltip: { enabled: true },
	},
	scales: {
		y: {
			beginAtZero: true,
			title: { display: true, text: 'ms', font: { size: 10 } },
			ticks: { font: { size: 9 } },
		},
		x: {
			ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 9 } },
		},
	},
	elements: {
		line: { tension: 0.4 },
		point: { radius: 1 },
	},
};

export function SparklineChart({ data, label, color, height = 120 }: SparklineChartProps) {
	const limited = data.slice(-50);

	const chartData = {
		labels: limited.map((d) => {
			try {
				return new Date(d.timestamp).toLocaleTimeString(undefined, {
					minute: '2-digit',
					second: '2-digit',
				});
			} catch {
				return '';
			}
		}),
		datasets: [
			{
				label,
				data: limited.map((d) => d.value),
				borderColor: color,
				backgroundColor: color.replace(')', ', 0.1)').replace('hsl', 'hsla'),
				fill: true,
			},
		],
	};

	return (
		<div style={{ height }}>
			<Line data={chartData} options={sparklineOptions} />
		</div>
	);
}
