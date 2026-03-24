import type { LucideIcon } from 'lucide-react';

export type Stage = 'draft' | 'brainstorm' | 'wish' | 'build' | 'review' | 'qa' | 'ship';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface PipelineColumn {
	stage: Stage;
	label: string;
	color: string;
	icon: LucideIcon;
	gate: string;
	action: string;
}

export interface PipelineItem {
	id: string;
	slug: string;
	title: string;
	summary: string;
	stage: Stage;
	priority: Priority;
	assignee: string;
	groups: { done: number; total: number } | null;
	createdAt: string;
	updatedAt: string;
}

export interface PipelineCardProps {
	item: PipelineItem;
	stageColor: string;
	onClick: () => void;
	className?: string;
}

// Lucide icons imported lazily in column component to avoid circular deps
// These are string keys mapped in KanbanColumn
export type StageIconName = 'inbox' | 'lightbulb' | 'sparkles' | 'hammer' | 'eye' | 'shield-check' | 'rocket';

export const STAGE_ICON_MAP: Record<Stage, StageIconName> = {
	draft: 'inbox',
	brainstorm: 'lightbulb',
	wish: 'sparkles',
	build: 'hammer',
	review: 'eye',
	qa: 'shield-check',
	ship: 'rocket',
};

export const PIPELINE_COLUMNS: Omit<PipelineColumn, 'icon'>[] = [
	{ stage: 'draft', label: 'Draft', color: 'var(--khal-stage-triage)', gate: 'Triage', action: 'Start brainstorm' },
	{
		stage: 'brainstorm',
		label: 'Brainstorm',
		color: 'var(--khal-stage-plan)',
		gate: 'Scope',
		action: 'Create wish',
	},
	{
		stage: 'wish',
		label: 'Wish',
		color: 'var(--khal-stage-backlog)',
		gate: 'Approve',
		action: 'Start build',
	},
	{ stage: 'build', label: 'Build', color: 'var(--khal-stage-build)', gate: 'Code complete', action: 'Request review' },
	{
		stage: 'review',
		label: 'Review',
		color: 'var(--khal-stage-review)',
		gate: 'Approved',
		action: 'Send to QA',
	},
	{ stage: 'qa', label: 'QA', color: 'var(--khal-stage-qa)', gate: 'Verified', action: 'Ship it' },
	{ stage: 'ship', label: 'Ship', color: 'var(--khal-stage-ship)', gate: 'Shipped', action: '' },
];

export const VALID_TRANSITIONS: Record<Stage, Stage[]> = {
	draft: ['brainstorm'],
	brainstorm: ['wish'],
	wish: ['build'],
	build: ['review'],
	review: ['qa', 'build'],
	qa: ['ship', 'build'],
	ship: [],
};

export const PRIORITY_ORDER: Record<Priority, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};
