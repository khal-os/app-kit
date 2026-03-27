'use client';

import * as React from 'react';
import { cn } from '../utils';

const sizeMap = { sm: 8, md: 10, lg: 12 } as const;

/** All recognized status states */
type StatusState = 'live' | 'online' | 'active' | 'working' | 'idle' | 'away' | 'queued' | 'error';

const stateConfig: Record<StatusState, { color: string; label: string; pulse: boolean }> = {
	live: { color: '#22c55e', label: 'Live', pulse: true },
	online: { color: '#22c55e', label: 'Online', pulse: false },
	active: { color: '#22c55e', label: 'Active', pulse: true },
	working: { color: '#f59e0b', label: 'Working', pulse: true },
	idle: { color: '#64748b', label: 'Idle', pulse: false },
	away: { color: '#64748b', label: 'Away', pulse: false },
	queued: { color: '#f59e0b', label: 'Queued', pulse: false },
	error: { color: '#ef4444', label: 'Error', pulse: true },
};

interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
	/** Typed state — determines color, pulse, and label automatically */
	state?: StatusState;
	/** Manual color override (legacy support) */
	color?: string;
	/** Manual pulse override */
	pulse?: boolean;
	size?: keyof typeof sizeMap;
	/** Manual label override */
	label?: string;
	/** Show text label next to dot */
	showLabel?: boolean;
}

function StatusDot({
	state,
	color: colorProp,
	pulse: pulseProp,
	size = 'md',
	label: labelProp,
	showLabel = false,
	className,
	style,
	...props
}: StatusDotProps) {
	const config = state ? stateConfig[state] : null;
	const color = colorProp ?? config?.color ?? '#64748b';
	const pulse = pulseProp ?? config?.pulse ?? false;
	const label = labelProp ?? config?.label;
	const px = sizeMap[size];

	return (
		<span
			role="status"
			aria-label={label}
			className={cn('relative inline-flex shrink-0 items-center gap-1.5', className)}
			style={style}
			{...props}
		>
			<span className="relative inline-flex shrink-0" style={{ width: px, height: px }}>
				{pulse && (
					<span
						className="absolute -inset-0.5 rounded-full"
						style={{
							backgroundColor: color,
							opacity: 0.35,
							animation: 'khal-pulse 2s ease-in-out infinite',
						}}
					/>
				)}
				<span
					className="absolute inset-0 rounded-full"
					style={{
						backgroundColor: color,
						boxShadow: pulse ? `0 0 ${px}px ${color}80` : undefined,
					}}
				/>
			</span>
			{showLabel && label && (
				<span className="text-[11px] leading-none" style={{ color }}>
					{label}
				</span>
			)}
		</span>
	);
}

export type { StatusDotProps, StatusState };
export { StatusDot, stateConfig };
