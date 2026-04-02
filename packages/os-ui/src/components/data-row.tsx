'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

/**
 * DataRow — LP section-level key-value / data display component.
 *
 * Extracted from khal-landing section components:
 * - Architecture.tsx: font-mono code rules (IF/THEN/ELSE patterns)
 * - Architecture.tsx: connection rows with status dots
 * - Omnichannel-spotlight.tsx: channel count rows (font-mono tabular-nums)
 * - Omnichannel-spotlight.tsx: observability inline data
 *
 * Renders a horizontal key-value pair with monospace font and optional accent.
 */
const dataRowVariants = cva('flex items-center gap-3 rounded-lg border border-[#FFFFFF14] font-mono', {
	variants: {
		variant: {
			/** Standard data row — subtle bg */
			default: 'bg-[#FFFFFF08] py-2.5 px-3',
			/** Inline/compact — for observability-style data */
			inline: 'bg-[#FFFFFF06] py-1.5 px-2.5 text-[11px]',
			/** Nested rule row — for indented rule displays */
			rule: 'bg-[#FFFFFF05] py-2.5 px-3',
		},
	},
	defaultVariants: {
		variant: 'default',
	},
});

interface DataRowProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof dataRowVariants> {
	/** The label/key portion (left side) */
	label: string;
	/** The value portion (right side, pushed to end) */
	value?: string;
	/** Accent color for the value text */
	accentColor?: string;
	/** Show a status dot before the label */
	statusDot?: boolean;
	/** Custom status dot color */
	dotColor?: string;
	/** Optional tag/badge to show before the label (e.g. "IF", "THEN") */
	tag?: string;
	/** Tag color — defaults to accent */
	tagColor?: string;
}

const DataRow = React.forwardRef<HTMLDivElement, DataRowProps>(
	({ className, variant, label, value, accentColor, statusDot, dotColor, tag, tagColor, children, ...props }, ref) => {
		return (
			<div ref={ref} className={cn(dataRowVariants({ variant }), className)} {...props}>
				{/* Status dot */}
				{statusDot && (
					<span className="size-[6px] shrink-0 rounded-full" style={{ backgroundColor: dotColor || '#FFFFFF40' }} />
				)}

				{/* Tag badge (IF/THEN/ELSE style) */}
				{tag && (
					<span
						className="shrink-0 rounded py-0.5 px-2 text-[10px] font-bold uppercase tracking-wide leading-3.5"
						style={{
							color: tagColor || 'var(--color-accent, #D49355)',
							backgroundColor: tagColor
								? `color-mix(in srgb, ${tagColor} 10%, transparent)`
								: 'rgba(var(--color-accent-rgb, 212,147,85), 0.1)',
						}}
					>
						{tag}
					</span>
				)}

				{/* Label */}
				<span className="text-[12px] text-[#FFFFFFCC] leading-4 min-w-0 truncate">{label}</span>

				{/* Spacer if value present */}
				{(value || children) && <span className="grow" />}

				{/* Value */}
				{value && (
					<span className="text-[12px] leading-4 tabular-nums shrink-0" style={{ color: accentColor || '#FFFFFF99' }}>
						{value}
					</span>
				)}

				{/* Custom children (for complex right-side content) */}
				{children}
			</div>
		);
	}
);
DataRow.displayName = 'DataRow';

export type { DataRowProps };
export { DataRow, dataRowVariants };
