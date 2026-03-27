'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

const progressBarVariants = cva(
	'relative w-full overflow-hidden rounded-full [background:var(--khal-border-default)]',
	{
		variants: {
			size: {
				sm: 'h-1.5',
				md: 'h-2.5',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	}
);

interface ProgressBarProps
	extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
		VariantProps<typeof progressBarVariants> {
	value: number;
	max?: number;
	color?: string;
	showLabel?: boolean;
}

function ProgressBar({
	value,
	max = 100,
	color = 'var(--khal-stage-build)',
	size,
	showLabel = false,
	className,
	...props
}: ProgressBarProps) {
	const percentage = Math.min(100, Math.max(0, (value / max) * 100));

	return (
		<div className={cn('flex items-center gap-2', className)} {...props}>
			<div
				role="progressbar"
				aria-valuenow={value}
				aria-valuemin={0}
				aria-valuemax={max}
				className={progressBarVariants({ size })}
			>
				<div
					className="h-full rounded-full"
					style={{
						width: `${percentage}%`,
						background: `linear-gradient(90deg, color-mix(in srgb, ${color} 85%, black), ${color})`,
						transition: 'width var(--khal-duration-normal) var(--khal-ease-spring)',
					}}
				/>
			</div>
			{showLabel && (
				<span className="shrink-0 text-xs tabular-nums opacity-60">
					{value}/{max}
				</span>
			)}
		</div>
	);
}

export type { ProgressBarProps };
export { ProgressBar, progressBarVariants };
