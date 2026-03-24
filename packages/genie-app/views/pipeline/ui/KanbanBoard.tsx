'use client';

import { PIPELINE_COLUMNS, type PipelineItem, STAGE_ICON_MAP, type Stage } from '../types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
	items: PipelineItem[];
	onCardClick: (item: PipelineItem) => void;
}

export function KanbanBoard({ items, onCardClick }: KanbanBoardProps) {
	const itemsByStage = new Map<Stage, PipelineItem[]>();
	for (const col of PIPELINE_COLUMNS) {
		itemsByStage.set(col.stage, []);
	}
	for (const item of items) {
		const bucket = itemsByStage.get(item.stage);
		if (bucket) bucket.push(item);
	}

	return (
		<div className="flex flex-1 gap-3 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
			{PIPELINE_COLUMNS.map((col) => (
				<KanbanColumn
					key={col.stage}
					stage={col.stage}
					label={col.label}
					color={col.color}
					iconName={STAGE_ICON_MAP[col.stage]}
					items={itemsByStage.get(col.stage) ?? []}
					onCardClick={onCardClick}
				/>
			))}
		</div>
	);
}
