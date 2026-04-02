'use client';

import { Avatar, Badge, cn, GlassCard, ProgressBar, StatusDot } from '@khal-os/ui';
import type { PipelineCardProps, Priority } from '../types';

const priorityVariantMap: Record<Priority, 'red' | 'amber' | 'blue' | 'gray'> = {
	critical: 'red',
	high: 'amber',
	medium: 'blue',
	low: 'gray',
};

function timeAgo(dateStr: string): string {
	const now = Date.now();
	const then = new Date(dateStr).getTime();
	const diffMs = now - then;
	const diffMin = Math.floor(diffMs / 60_000);
	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffH = Math.floor(diffMin / 60);
	if (diffH < 24) return `${diffH}h ago`;
	const diffD = Math.floor(diffH / 24);
	return `${diffD}d ago`;
}

export function PipelineCard({ item, stageColor, onClick, className }: PipelineCardProps) {
	const isActive = item.stage === 'build' || item.stage === 'review';

	return (
		<GlassCard hover onClick={onClick} padding="sm" className={cn('w-full', className)}>
			<div className="flex flex-col gap-2">
				{/* Header: status dot + title */}
				<div className="flex items-start gap-2">
					<div className="mt-1 shrink-0">
						<StatusDot color={stageColor} pulse={isActive} size="sm" label={item.stage} />
					</div>
					<h4 className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: 'var(--khal-text-primary)' }}>
						{item.title}
					</h4>
				</div>

				{/* Summary */}
				<p className="line-clamp-2 text-[12px] leading-relaxed" style={{ color: 'var(--khal-text-secondary)' }}>
					{item.summary}
				</p>

				{/* Progress bar (if groups exist) */}
				{item.groups && (
					<ProgressBar value={item.groups.done} max={item.groups.total} color={stageColor} size="sm" showLabel />
				)}

				{/* Bottom row: avatar + priority badge + time */}
				<div className="flex items-center gap-2">
					<Avatar name={item.assignee} size="sm" />
					<Badge variant={priorityVariantMap[item.priority]} size="sm">
						{item.priority}
					</Badge>
					<span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--khal-text-muted)' }}>
						{timeAgo(item.updatedAt)}
					</span>
				</div>
			</div>
		</GlassCard>
	);
}
