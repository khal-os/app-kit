'use client';

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PipelineItem, Priority } from '../types';

interface PipelineFiltersState {
	searchQuery: string;
	priorityFilter: Priority | null;
	assigneeFilter: string | null;
	setSearchQuery: (query: string) => void;
	setPriorityFilter: (priority: Priority | null) => void;
	setAssigneeFilter: (assignee: string | null) => void;
	clearFilters: () => void;
}

export const usePipelineFilters = create<PipelineFiltersState>()(
	persist(
		(set) => ({
			searchQuery: '',
			priorityFilter: null,
			assigneeFilter: null,
			setSearchQuery: (searchQuery) => set({ searchQuery }),
			setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
			setAssigneeFilter: (assigneeFilter) => set({ assigneeFilter }),
			clearFilters: () => set({ searchQuery: '', priorityFilter: null, assigneeFilter: null }),
		}),
		{
			name: 'pipeline-filters',
		}
	)
);

/** Derives filtered items from source data + current filter state. */
export function useFilteredItems(items: PipelineItem[]): PipelineItem[] {
	const { searchQuery, priorityFilter, assigneeFilter } = usePipelineFilters();

	return useMemo(() => {
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
}
