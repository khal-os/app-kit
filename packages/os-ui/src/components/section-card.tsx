'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

/**
 * SectionCard — LP section-level card component.
 *
 * Extracted from khal-landing section components (architecture.tsx, fast-secure.tsx).
 * Two variants matching the LP's two card styles:
 * - `default`: full-border card (architecture section outer cards)
 * - `inset`: top-left border card (architecture mockup panels)
 */
const sectionCardVariants = cva('relative flex flex-col overflow-hidden', {
	variants: {
		variant: {
			default: 'rounded-2xl border border-[#FFFFFF1A] bg-[#FFFFFF0A]',
			inset: 'rounded-tl-xl border-t border-l border-[#FFFFFF26] bg-[#111111]',
			solid: 'rounded-2xl border border-[#FFFFFF1A] bg-[#0D0D0D]',
		},
		padding: {
			none: '',
			sm: 'p-4',
			md: 'p-5 sm:p-6',
			lg: 'p-5 sm:p-6 md:p-8',
		},
	},
	defaultVariants: {
		variant: 'default',
		padding: 'md',
	},
});

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof sectionCardVariants> {
	/** Optional gradient overlay color (hex). Renders a subtle top-down gradient. */
	glow?: string;
}

const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
	({ className, variant, padding, glow, children, ...props }, ref) => {
		return (
			<div ref={ref} className={cn(sectionCardVariants({ variant, padding }), className)} {...props}>
				{glow && (
					<div
						className="pointer-events-none absolute inset-0 z-0"
						style={{
							background: `linear-gradient(180deg, ${glow}22 0%, transparent 60%)`,
						}}
					/>
				)}
				<div className="relative z-10 flex flex-col h-full">{children}</div>
			</div>
		);
	}
);
SectionCard.displayName = 'SectionCard';

/**
 * SectionCardHeader — optional header row with bottom border separator.
 * Matches the LP mockup panel headers: `py-3 px-4 border-b border-[#FFFFFF1A]`.
 */
function SectionCardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn('flex items-center justify-between py-3 px-4 border-b border-[#FFFFFF1A]', className)}
			{...props}
		>
			{children}
		</div>
	);
}
SectionCardHeader.displayName = 'SectionCardHeader';

export type { SectionCardProps };
export { SectionCard, SectionCardHeader, sectionCardVariants };
