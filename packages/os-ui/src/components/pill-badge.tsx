'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

/**
 * PillBadge — LP section-level badge/tag component.
 *
 * Extracted from khal-landing section components:
 * - Capability tags (omnichannel-spotlight.tsx)
 * - Section label pills (fast-secure.tsx header)
 * - Compliance badges (fast-secure.tsx badge strip)
 * - Accent badges (metrics.tsx ROI calculator)
 *
 * Always uppercase with wide tracking — the LP's signature badge style.
 */
const pillBadgeVariants = cva(
	'inline-flex items-center gap-1.5 rounded-full font-medium uppercase leading-none whitespace-nowrap',
	{
		variants: {
			variant: {
				/** Subtle border badge — compliance tags, capability tags */
				default: 'border border-[#FFFFFF26] bg-[#FFFFFF08] text-[#FFFFFFCC]',
				/** Muted badge — less prominent */
				muted: 'border border-[#FFFFFF14] bg-[#FFFFFF05] text-[#FFFFFFCC]',
				/** Accent-filled badge — ROI labels, active state badges */
				accent: 'text-[var(--color-accent,#D49355)] bg-[rgba(var(--color-accent-rgb,212,147,85),0.12)]',
			},
			size: {
				sm: 'py-1 px-2.5 text-[10px] tracking-[0.08em]',
				md: 'py-1.5 px-3.5 text-[11px] tracking-widest',
				lg: 'py-2 px-4 text-[11px] tracking-widest',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	}
);

interface PillBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillBadgeVariants> {
	/** Show a small dot indicator before the text */
	dot?: boolean;
	/** Custom dot color (defaults to current text color at 40% opacity) */
	dotColor?: string;
}

const PillBadge = React.forwardRef<HTMLSpanElement, PillBadgeProps>(
	({ className, variant, size, dot, dotColor, children, ...props }, ref) => {
		return (
			<span ref={ref} className={cn(pillBadgeVariants({ variant, size }), className)} {...props}>
				{dot && (
					<span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor || '#FFFFFF40' }} />
				)}
				{children}
			</span>
		);
	}
);
PillBadge.displayName = 'PillBadge';

export type { PillBadgeProps };
export { PillBadge, pillBadgeVariants };
