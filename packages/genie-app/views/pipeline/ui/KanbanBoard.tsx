'use client';

import { PIPELINE_COLUMNS, type PipelineItem, STAGE_ICON_MAP, type Stage } from '../types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
	items: PipelineItem[];
	columns?: typeof PIPELINE_COLUMNS;
	onCardClick: (item: PipelineItem) => void;
}

export function KanbanBoard({ items, columns, onCardClick }: KanbanBoardProps) {
	const cols = columns ?? PIPELINE_COLUMNS;

	const itemsByStage = new Map<Stage, PipelineItem[]>();
	for (const col of cols) {
		itemsByStage.set(col.stage, []);
	}
	for (const item of items) {
		const bucket = itemsByStage.get(item.stage);
		if (bucket) bucket.push(item);
	}

	return (
		<div className="flex flex-1 gap-3 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: 'none' }}>
			{cols.map((col) => (
				<KanbanColumn
					key={col.stage}
					stage={col.stage}
					label={col.label}
					color={col.color}
					iconName={STAGE_ICON_MAP[col.stage] ?? 'inbox'}
					items={itemsByStage.get(col.stage) ?? []}
					onCardClick={onCardClick}
				/>
			))}
		</div>
	);
}
