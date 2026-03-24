'use client';

import { useCallback, useMemo, useState } from 'react';
import { PIPELINE_COLUMNS, type PipelineItem, type Priority, type Stage } from '../types';
import { KanbanBoard } from './KanbanBoard';
import { PipelineToolbar } from './PipelineToolbar';

interface PipelineViewProps {
	items: PipelineItem[];
	onCardClick?: (item: PipelineItem) => void;
	onRefresh?: () => void;
}

export function PipelineView({ items, onCardClick, onRefresh }: PipelineViewProps) {
	const [searchQuery, setSearchQuery] = useState('');
	const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
	const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

	const assignees = useMemo(() => {
		const names = new Set<string>();
		for (const item of items) {
			if (item.assignee) names.add(item.assignee);
		}
		return Array.from(names).sort();
	}, [items]);

	const filteredItems = useMemo(() => {
		let result = items;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(item) =>
					item.title.toLowerCase().includes(q) ||
					item.summary.toLowerCase().includes(q) ||
					item.slug.toLowerCase().includes(q)
			);
		}

		if (priorityFilter) {
			result = result.filter((item) => item.priority === priorityFilter);
		}

		if (assigneeFilter) {
			result = result.filter((item) => item.assignee === assigneeFilter);
		}

		return result;
	}, [items, searchQuery, priorityFilter, assigneeFilter]);

	const handleCardClick = useCallback(
		(item: PipelineItem) => {
			onCardClick?.(item);
		},
		[onCardClick]
	);

	const handleRefresh = useCallback(() => {
		onRefresh?.();
	}, [onRefresh]);

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
		<div className="flex h-full flex-col" style={{ background: 'var(--khal-bg-secondary)' }}>
			{/* Toolbar */}
			<PipelineToolbar
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				priorityFilter={priorityFilter}
				onPriorityChange={setPriorityFilter}
				assigneeFilter={assigneeFilter}
				onAssigneeChange={setAssigneeFilter}
				assignees={assignees}
				onRefresh={handleRefresh}
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
		</div>
	);
}

export { PipelineView as Pipeline };
