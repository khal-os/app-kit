'use client';

import { Eye, Hammer, Inbox, Lightbulb, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/os-primitives/empty-state';
import type { PipelineItem, Stage, StageIconName } from '../types';
import { PipelineCard } from './PipelineCard';

const iconComponents: Record<StageIconName, typeof Inbox> = {
	inbox: Inbox,
	lightbulb: Lightbulb,
	sparkles: Sparkles,
	hammer: Hammer,
	eye: Eye,
	'shield-check': ShieldCheck,
	rocket: Rocket,
};

interface KanbanColumnProps {
	stage: Stage;
	label: string;
	color: string;
	iconName: StageIconName;
	items: PipelineItem[];
	onCardClick: (item: PipelineItem) => void;
}

export function KanbanColumn({ stage, label, color, iconName, items, onCardClick }: KanbanColumnProps) {
	const Icon = iconComponents[iconName];

	return (
		<div className="flex min-w-[180px] flex-1 flex-col" data-stage={stage}>
			{/* Top accent border */}
			<div className="h-0.5 w-full rounded-full" style={{ backgroundColor: color }} />

			{/* Header */}
			<div className="flex items-center gap-2 px-1 py-2.5">
				<Icon className="h-4 w-4 shrink-0" style={{ color }} />
				<span className="text-[13px] font-medium" style={{ color: 'var(--khal-text-primary)' }}>
					{label}
				</span>
				<span
					className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium"
					style={{
						backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
						color,
					}}
				>
					{items.length}
				</span>
			</div>

			{/* Card stack */}
			<div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2">
				{items.length === 0 ? (
					<EmptyState compact title="No items" description={`Nothing in ${label.toLowerCase()}`} icon={<Icon />} />
				) : (
					items.map((item) => (
						<PipelineCard key={item.id} item={item} stageColor={color} onClick={() => onCardClick(item)} />
					))
				)}
			</div>
		</div>
	);
}
