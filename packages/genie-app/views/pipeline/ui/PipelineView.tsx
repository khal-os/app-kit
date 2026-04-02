'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePipelineData } from '../hooks/usePipelineData';
import { useFilteredItems, usePipelineFilters } from '../hooks/usePipelineFilters';
import { PIPELINE_COLUMNS, type PipelineItem, type Stage } from '../types';
import { CardDetailPanel } from './CardDetailPanel';
import { KanbanBoard } from './KanbanBoard';
import { PipelineToolbar } from './PipelineToolbar';

interface PipelineViewProps {
	windowId?: string;
	meta?: Record<string, unknown>;
}

/** Map PG board columns to the shape KanbanBoard expects. */
function mapBoardColumns(
	boardCols: Array<{ name: string; label: string; color: string; gate: string; action: string | null }>
): typeof PIPELINE_COLUMNS {
	return boardCols.map((col) => ({
		stage: col.name as Stage,
		label: col.label,
		color: col.color,
		gate: col.gate,
		action: col.action ?? '',
	}));
}

export function PipelineView(_props: PipelineViewProps) {
	const { items, columns: boardColumns, loading, refreshData, moveItem } = usePipelineData();
	const { searchQuery, priorityFilter, assigneeFilter, setSearchQuery, setPriorityFilter, setAssigneeFilter } =
		usePipelineFilters();

	const filteredItems = useFilteredItems(items);
	const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);

	// Use dynamic columns from PG board, fall back to hardcoded
	const columns = useMemo(
		() => (boardColumns.length > 0 ? mapBoardColumns(boardColumns) : PIPELINE_COLUMNS),
		[boardColumns]
	);

	const assignees = useMemo(() => {
		const names = new Set<string>();
		for (const item of items) {
			if (item.assignee) names.add(item.assignee);
		}
		return Array.from(names).sort();
	}, [items]);

	const handleCardClick = useCallback((item: PipelineItem) => {
		setSelectedItem(item);
	}, []);

	const handleCloseDetail = useCallback(() => {
		setSelectedItem(null);
	}, []);

	const handleMove = useCallback(
		(itemId: string, toStage: Stage) => {
			moveItem(itemId, toStage);
			setSelectedItem((prev) =>
				prev?.id === itemId ? { ...prev, stage: toStage, updatedAt: new Date().toISOString() } : prev
			);
		},
		[moveItem]
	);

	const stageCounts = useMemo(() => {
		const counts = new Map<Stage, number>();
		for (const col of columns) {
			counts.set(col.stage, 0);
		}
		for (const item of filteredItems) {
			counts.set(item.stage, (counts.get(item.stage) ?? 0) + 1);
		}
		return counts;
	}, [filteredItems, columns]);

	return (
		<div className="relative flex h-full flex-col" style={{ background: 'var(--khal-bg-secondary)' }}>
			<PipelineToolbar
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				priorityFilter={priorityFilter}
				onPriorityChange={setPriorityFilter}
				assigneeFilter={assigneeFilter}
				onAssigneeChange={setAssigneeFilter}
				assignees={assignees}
				onRefresh={refreshData}
			/>

			{loading ? (
				<div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--khal-text-muted)' }}>
					Loading pipeline...
				</div>
			) : (
				<KanbanBoard items={filteredItems} columns={columns} onCardClick={handleCardClick} />
			)}

			<div
				className="flex h-8 shrink-0 items-center gap-4 border-t px-3 text-[11px] tabular-nums"
				style={{
					borderColor: 'var(--khal-border-default)',
					color: 'var(--khal-text-muted)',
				}}
			>
				<span>{filteredItems.length} items</span>
				<span className="h-3 w-px" style={{ backgroundColor: 'var(--khal-border-default)' }} />
				{columns.map((col) => (
					<span key={col.stage} className="flex items-center gap-1">
						<span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
						{col.label}: {stageCounts.get(col.stage) ?? 0}
					</span>
				))}
			</div>

			<CardDetailPanel item={selectedItem} onClose={handleCloseDetail} onMove={handleMove} />
		</div>
	);
}

export { PipelineView as Pipeline };
