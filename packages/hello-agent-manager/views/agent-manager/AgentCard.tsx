'use client';

import { Badge, Button, GlassCard } from '@khal-os/ui';
import { Globe, Mic, Pencil, Play, Square, Trash2 } from 'lucide-react';
import { CostBar } from './CostBar';
import type { AgentConfig } from './types';

const statusConfig = {
	running: { label: 'Running', variant: 'green' as const },
	stopped: { label: 'Stopped', variant: 'gray' as const },
	error: { label: 'Error', variant: 'red' as const },
};

interface AgentCardProps {
	agent: AgentConfig;
	metrics?: { cost_today_usd: number };
	loading?: boolean;
	onEdit?: (agent: AgentConfig) => void;
	onStart?: (agent: AgentConfig) => void;
	onStop?: (agent: AgentConfig) => void;
	onDelete?: (agent: AgentConfig) => void;
}

export function AgentCard({ agent, metrics, loading, onEdit, onStart, onStop, onDelete }: AgentCardProps) {
	const { label, variant } = statusConfig[agent.status];
	const disabled = !!loading;

	return (
		<GlassCard hover padding="md">
			<div className="flex flex-col gap-3">
				<div className="flex items-start justify-between">
					<div className="min-w-0 flex-1">
						<h3 className="truncate font-medium text-foreground">{agent.name}</h3>
						<p className="truncate text-sm text-muted">{agent.slug}</p>
					</div>
					<Badge variant={variant} size="sm">
						{label}
					</Badge>
				</div>

				<div className="flex items-center gap-3 text-xs text-muted">
					<span className="inline-flex items-center gap-1">
						<Mic className="h-3 w-3" />
						{agent.voice_id}
					</span>
					<span className="inline-flex items-center gap-1">
						<Globe className="h-3 w-3" />
						{agent.language}
					</span>
				</div>

				<CostBar spent={metrics?.cost_today_usd ?? 0} budget={agent.daily_budget_usd} />

				<div className="flex items-center gap-1 border-t border-border pt-2">
					{agent.status === 'running' ? (
						<Button
							size="small"
							variant="ghost"
							prefix={<Square className="h-3.5 w-3.5" />}
							onClick={() => onStop?.(agent)}
							disabled={disabled}
							loading={loading}
						>
							Stop
						</Button>
					) : (
						<Button
							size="small"
							variant="ghost"
							prefix={<Play className="h-3.5 w-3.5" />}
							onClick={() => onStart?.(agent)}
							disabled={disabled}
							loading={loading}
						>
							Start
						</Button>
					)}
					<Button
						size="small"
						variant="ghost"
						prefix={<Pencil className="h-3.5 w-3.5" />}
						onClick={() => onEdit?.(agent)}
						disabled={disabled}
					>
						Edit
					</Button>
					<div className="flex-1" />
					<Button
						size="small"
						variant="ghost"
						prefix={<Trash2 className="h-3.5 w-3.5 text-error" />}
						onClick={() => onDelete?.(agent)}
						disabled={disabled}
					/>
				</div>
			</div>
		</GlassCard>
	);
}
