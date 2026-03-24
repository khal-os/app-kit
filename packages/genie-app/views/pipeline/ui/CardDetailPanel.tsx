'use client';

import { ArrowRight, Calendar, ChevronDown, Clock, Tag, User, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassCard } from '@/components/ui/glass-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusDot } from '@/components/ui/status-dot';
import { PIPELINE_COLUMNS, type PipelineItem, type Priority, type Stage, VALID_TRANSITIONS } from '../types';

interface CardDetailPanelProps {
	item: PipelineItem | null;
	onClose: () => void;
	onMove: (itemId: string, toStage: Stage) => void;
}

const priorityVariantMap: Record<Priority, 'red' | 'amber' | 'blue' | 'gray'> = {
	critical: 'red',
	high: 'amber',
	medium: 'blue',
	low: 'gray',
};

function getStageColor(stage: Stage): string {
	return PIPELINE_COLUMNS.find((c) => c.stage === stage)?.color ?? 'var(--khal-text-muted)';
}

function getStageLabel(stage: Stage): string {
	return PIPELINE_COLUMNS.find((c) => c.stage === stage)?.label ?? stage;
}

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function CardDetailPanel({ item, onClose, onMove }: CardDetailPanelProps) {
	const panelRef = useRef<HTMLDivElement>(null);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		},
		[onClose]
	);

	useEffect(() => {
		if (!item) return;
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [item, handleKeyDown]);

	// Focus trap: focus the panel when it opens
	useEffect(() => {
		if (item && panelRef.current) {
			panelRef.current.focus();
		}
	}, [item]);

	if (!item) return null;

	const validNext = VALID_TRANSITIONS[item.stage];
	const stageColor = getStageColor(item.stage);

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-40"
				style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === 'Escape') onClose();
				}}
			/>

			{/* Panel */}
			<div
				ref={panelRef}
				className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col overflow-y-auto border-l"
				style={{
					backgroundColor: 'var(--khal-bg-primary)',
					borderColor: 'var(--khal-border-default)',
				}}
				tabIndex={-1}
			>
				{/* Header */}
				<div
					className="flex shrink-0 items-center justify-between border-b px-4 py-3"
					style={{ borderColor: 'var(--khal-border-default)' }}
				>
					<div className="flex items-center gap-2">
						<StatusDot
							color={stageColor}
							pulse={item.stage === 'build' || item.stage === 'review'}
							size="md"
							label={item.stage}
						/>
						<span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: stageColor }}>
							{getStageLabel(item.stage)}
						</span>
					</div>
					<Button variant="ghost" size="small" className="h-7 w-7 p-0" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				{/* Content */}
				<div className="flex flex-1 flex-col gap-5 p-4">
					{/* Title + slug */}
					<div>
						<h2 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--khal-text-primary)' }}>
							{item.title}
						</h2>
						<span className="mt-1 block text-[11px] font-mono" style={{ color: 'var(--khal-text-muted)' }}>
							{item.slug}
						</span>
					</div>

					{/* Summary */}
					<div>
						<SectionLabel>Summary</SectionLabel>
						<p className="text-[13px] leading-relaxed" style={{ color: 'var(--khal-text-secondary)' }}>
							{item.summary}
						</p>
					</div>

					{/* Progress */}
					{item.groups && (
						<div>
							<SectionLabel>Progress</SectionLabel>
							<ProgressBar value={item.groups.done} max={item.groups.total} color={stageColor} size="md" showLabel />
						</div>
					)}

					{/* Move To */}
					{validNext.length > 0 && (
						<div>
							<SectionLabel>Actions</SectionLabel>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="small" className="h-8 gap-1.5 px-3 text-[12px]">
										<ArrowRight className="h-3.5 w-3.5" />
										Move to...
										<ChevronDown className="h-3 w-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									{validNext.map((nextStage) => (
										<DropdownMenuItem key={nextStage} onClick={() => onMove(item.id, nextStage)}>
											<span
												className="mr-2 inline-block h-2 w-2 rounded-full"
												style={{ backgroundColor: getStageColor(nextStage) }}
											/>
											{getStageLabel(nextStage)}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}

					{/* Metadata grid */}
					<GlassCard padding="md">
						<div className="flex flex-col gap-3">
							{/* Assignee */}
							<MetaRow icon={<User className="h-3.5 w-3.5" />} label="Assignee">
								<div className="flex items-center gap-2">
									<Avatar name={item.assignee} size="sm" />
									<span className="text-[13px]" style={{ color: 'var(--khal-text-primary)' }}>
										{item.assignee}
									</span>
								</div>
							</MetaRow>

							{/* Priority */}
							<MetaRow icon={<Tag className="h-3.5 w-3.5" />} label="Priority">
								<Badge variant={priorityVariantMap[item.priority]} size="sm">
									{item.priority}
								</Badge>
							</MetaRow>

							{/* Created */}
							<MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created">
								<span className="text-[12px]" style={{ color: 'var(--khal-text-secondary)' }}>
									{formatDate(item.createdAt)}
								</span>
							</MetaRow>

							{/* Updated */}
							<MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="Updated">
								<span className="text-[12px]" style={{ color: 'var(--khal-text-secondary)' }}>
									{formatDate(item.updatedAt)}
								</span>
							</MetaRow>
						</div>
					</GlassCard>

					{/* Stage history (simulated) */}
					<div>
						<SectionLabel>Stage History</SectionLabel>
						<div className="flex flex-col gap-1.5">
							{PIPELINE_COLUMNS.filter(
								(_, idx) => idx <= PIPELINE_COLUMNS.findIndex((c) => c.stage === item.stage)
							).map((col, idx, arr) => (
								<div key={col.stage} className="flex items-center gap-2 text-[12px]">
									<span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
									<span
										style={{
											color: idx === arr.length - 1 ? 'var(--khal-text-primary)' : 'var(--khal-text-muted)',
											fontWeight: idx === arr.length - 1 ? 500 : 400,
										}}
									>
										{col.label}
									</span>
									{idx < arr.length - 1 && (
										<ArrowRight className="h-3 w-3 shrink-0" style={{ color: 'var(--khal-text-muted)' }} />
									)}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--khal-text-muted)' }}>
			{children}
		</h3>
	);
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2" style={{ color: 'var(--khal-text-muted)' }}>
				{icon}
				<span className="text-[12px]">{label}</span>
			</div>
			{children}
		</div>
	);
}
