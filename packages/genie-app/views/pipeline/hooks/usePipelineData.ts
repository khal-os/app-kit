'use client';

import { getNatsClient } from '@khal-os/sdk/app';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SUBJECTS } from '../../../lib/subjects';
import type { PipelineItem, Stage } from '../types';
import { PIPELINE_COLUMNS } from '../types';

/** Task record shape from `genie task list --json` via NATS. */
interface TaskRecord {
	id: string;
	seq: number;
	title: string;
	description: string | null;
	stage: string;
	status: string;
	priority: string;
	groupName: string | null;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

interface TaskListResponse {
	tasks?: TaskRecord[];
	error?: string;
}

/** Board column shape from `genie board show --json` via NATS. */
interface BoardColumn {
	id: string;
	name: string;
	label: string;
	color: string;
	gate: string;
	action: string | null;
	position: number;
}

interface BoardShowResponse {
	board?: { columns: BoardColumn[] };
	error?: string;
}

interface BoardListResponse {
	boards?: Array<{ name: string }>;
	error?: string;
}

const VALID_STAGES = new Set(PIPELINE_COLUMNS.map((c) => c.stage));

function mapTaskToItem(task: TaskRecord): PipelineItem | null {
	const stage = task.stage as Stage;
	if (!VALID_STAGES.has(stage)) return null;

	const meta = task.metadata ?? {};
	return {
		id: task.id,
		slug: (meta.wishSlug as string) ?? `task-${task.seq}`,
		title: task.title,
		summary: task.description ?? '',
		stage,
		priority: (task.priority as PipelineItem['priority']) ?? 'medium',
		assignee: (meta.assignee as string) ?? task.groupName ?? '',
		groups: meta.groups ? (meta.groups as { done: number; total: number }) : null,
		createdAt: task.createdAt,
		updatedAt: task.updatedAt,
	};
}

export function usePipelineData() {
	const [items, setItems] = useState<PipelineItem[]>([]);
	const [columns, setColumns] = useState<BoardColumn[]>([]);
	const [loading, setLoading] = useState(true);

	const client = useMemo(() => {
		try {
			return getNatsClient();
		} catch {
			return null;
		}
	}, []);

	const fetchTasks = useCallback(async () => {
		if (!client) return;
		try {
			const raw = await client.request(SUBJECTS.task.list(), {}, 5000);
			const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as TaskListResponse;
			if (data.tasks) {
				const mapped = data.tasks.map(mapTaskToItem).filter((x): x is PipelineItem => x !== null);
				setItems(mapped);
			}
		} catch {
			// Keep current items on error
		} finally {
			setLoading(false);
		}
	}, [client]);

	const fetchBoard = useCallback(async () => {
		if (!client) return;
		try {
			// Get first board
			const listRaw = await client.request(SUBJECTS.board.list(), {}, 5000);
			const listData = (typeof listRaw === 'string' ? JSON.parse(listRaw) : listRaw) as BoardListResponse;
			const boardName = listData.boards?.[0]?.name;
			if (!boardName) return;

			const showRaw = await client.request(SUBJECTS.board.show(), { name: boardName }, 5000);
			const showData = (typeof showRaw === 'string' ? JSON.parse(showRaw) : showRaw) as BoardShowResponse;
			if (showData.board?.columns) {
				setColumns(showData.board.columns);
			}
		} catch {
			// Keep default columns on error
		}
	}, [client]);

	// Initial fetch
	useEffect(() => {
		fetchTasks();
		fetchBoard();
	}, [fetchTasks, fetchBoard]);

	// Real-time subscriptions
	useEffect(() => {
		if (!client) return;
		const unsubs = [
			client.subscribe(SUBJECTS.wish.changed(), () => fetchTasks()),
			client.subscribe(SUBJECTS.agents.changed(), () => fetchTasks()),
			client.subscribe(SUBJECTS.teams.changed(), () => fetchTasks()),
		];
		return () => {
			for (const fn of unsubs) fn();
		};
	}, [client, fetchTasks]);

	const refreshData = useCallback(() => {
		fetchTasks();
		fetchBoard();
	}, [fetchTasks, fetchBoard]);

	const moveItem = useCallback(
		async (itemId: string, toStage: PipelineItem['stage']) => {
			// Optimistic update
			setItems((prev) =>
				prev.map((item) =>
					item.id === itemId ? { ...item, stage: toStage, updatedAt: new Date().toISOString() } : item
				)
			);
			// Persist via NATS
			if (client) {
				try {
					await client.request(SUBJECTS.task.move(), { id: itemId, to: toStage }, 5000);
				} catch {
					// Revert on failure by re-fetching
					fetchTasks();
				}
			}
		},
		[client, fetchTasks]
	);

	return { items, columns, loading, refreshData, moveItem };
}
