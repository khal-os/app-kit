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

export function PipelineView(_props: PipelineViewProps) {
	const { items, refreshData, moveItem } = usePipelineData();
	const { searchQuery, priorityFilter, assigneeFilter, setSearchQuery, setPriorityFilter, setAssigneeFilter } =
		usePipelineFilters();

	const filteredItems = useFilteredItems(items);
	const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);

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
			// Update selected item if it's the one being moved
			setSelectedItem((prev) =>
				prev?.id === itemId ? { ...prev, stage: toStage, updatedAt: new Date().toISOString() } : prev
			);
		},
		[moveItem]
	);

	// Per-stage counts for the status bar
	const stageCounts = useMemo(() => {
		const counts = new Map<Stage, number>();
		for (const col of PIPELINE_COLUMNS) {
			counts.set(col.stage, 0);
		}
		for (const item of filteredItems) {
			counts.set(item.stage, (counts.get(item.stage) ?? 0) + 1);
		}
		return counts;
	}, [filteredItems]);

	return (
		<div className="relative flex h-full flex-col" style={{ background: 'var(--khal-bg-secondary)' }}>
			{/* Toolbar */}
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

			{/* Kanban board */}
			<KanbanBoard items={filteredItems} onCardClick={handleCardClick} />

			{/* Status bar */}
			<div
				className="flex h-8 shrink-0 items-center gap-4 border-t px-3 text-[11px] tabular-nums"
				style={{
					borderColor: 'var(--khal-border-default)',
					color: 'var(--khal-text-muted)',
				}}
			>
				<span>{filteredItems.length} items</span>
				<span className="h-3 w-px" style={{ backgroundColor: 'var(--khal-border-default)' }} />
				{PIPELINE_COLUMNS.map((col) => (
					<span key={col.stage} className="flex items-center gap-1">
						<span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
						{col.label}: {stageCounts.get(col.stage) ?? 0}
					</span>
				))}
			</div>

			{/* Detail panel */}
			<CardDetailPanel item={selectedItem} onClose={handleCloseDetail} onMove={handleMove} />
		</div>
	);
}

export { PipelineView as Pipeline };
