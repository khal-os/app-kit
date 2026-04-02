'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

/**
 * MetricDisplay — LP section-level metric/stat component.
 *
 * Extracted from khal-landing section components:
 * - Stat cards in metrics.tsx (large numbers with suffix/prefix)
 * - Metric tiles in architecture.tsx AppBuilderMockup
 * - ROI projected savings in metrics.tsx
 *
 * Renders a large highlighted value with a label and optional description.
 */
const metricDisplayVariants = cva('flex flex-col', {
	variants: {
		size: {
			/** Compact — for inline/tile use (architecture mockup metric tiles) */
			sm: 'gap-1',
			/** Standard — for dashboard displays */
			md: 'gap-1.5',
			/** Large — hero stat cards (metrics.tsx) */
			lg: 'gap-2',
		},
	},
	defaultVariants: {
		size: 'md',
	},
});

const valueSizeMap = {
	sm: 'text-[22px] font-semibold leading-7 tracking-tight',
	md: 'text-[28px] font-semibold leading-8 tracking-[-0.02em]',
	lg: 'text-[36px] sm:text-[44px] font-semibold leading-none tracking-[-0.04em]',
} as const;

const labelSizeMap = {
	sm: 'text-[11px] uppercase tracking-[0.06em] text-[#FFFFFF80] font-medium leading-3.5',
	md: 'text-[13px] text-[#FFFFFFCC] font-medium leading-4',
	lg: 'text-[15px] text-[#FFFFFFCC] font-medium leading-5',
} as const;

interface MetricDisplayProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof metricDisplayVariants> {
	/** The primary value to display */
	value: string | number;
	/** Label describing the metric */
	label: string;
	/** Optional description/subtext below the label */
	description?: string;
	/** Optional prefix before the value (e.g. "+", "$") */
	prefix?: string;
	/** Optional suffix after the value (e.g. "%", "pts", "ms") */
	suffix?: string;
	/** Accent color for the value. Defaults to current text color. */
	accentColor?: string;
}

const MetricDisplay = React.forwardRef<HTMLDivElement, MetricDisplayProps>(
	({ className, size = 'md', value, label, description, prefix, suffix, accentColor, ...props }, ref) => {
		const resolvedSize = (size ?? 'md') as 'sm' | 'md' | 'lg';

		return (
			<div ref={ref} className={cn(metricDisplayVariants({ size }), className)} {...props}>
				{/* Label above value for sm size (matches LP tile pattern) */}
				{resolvedSize === 'sm' && <span className={labelSizeMap[resolvedSize]}>{label}</span>}

				{/* Value */}
				<div
					className={cn(valueSizeMap[resolvedSize], 'tabular-nums')}
					style={accentColor ? { color: accentColor } : undefined}
				>
					{prefix && <span>{prefix}</span>}
					<span>{value}</span>
					{suffix && (
						<span className={resolvedSize === 'lg' ? 'text-[32px] tracking-[-0.02em] ml-0.5' : 'ml-0.5'}>{suffix}</span>
					)}
				</div>

				{/* Label below value for md/lg sizes */}
				{resolvedSize !== 'sm' && <span className={labelSizeMap[resolvedSize]}>{label}</span>}

				{/* Description */}
				{description && <span className="text-[13px] text-[#FFFFFF80] leading-4">{description}</span>}
			</div>
		);
	}
);
MetricDisplay.displayName = 'MetricDisplay';

export type { MetricDisplayProps };
export { MetricDisplay, metricDisplayVariants };
