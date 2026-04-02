'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

const glassCardVariants = cva(
	'relative overflow-hidden border transition-all [background:var(--khal-glass-tint)] [border-color:var(--khal-glass-border)]',
	{
		variants: {
			variant: {
				default: '[box-shadow:var(--khal-shadow-sm)]',
				raised: '[box-shadow:var(--khal-shadow-md)]',
			},
			padding: {
				sm: 'p-3',
				md: 'p-4',
				lg: 'p-6',
			},
		},
		defaultVariants: {
			variant: 'default',
			padding: 'md',
		},
	}
);

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof glassCardVariants> {
	hover?: boolean;
	glow?: string;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
	({ className, variant, padding, hover = false, glow, style, children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					glassCardVariants({ variant, padding }),
					hover && [
						'cursor-pointer',
						'hover:-translate-y-0.5',
						'hover:[border-color:var(--khal-border-strong)]',
						'hover:[box-shadow:var(--khal-shadow-lg)]',
					],
					className
				)}
				style={{
					backdropFilter: 'var(--khal-glass-filter)',
					WebkitBackdropFilter: 'var(--khal-glass-filter)',
					borderRadius: 'var(--khal-radius-xl)',
					transitionTimingFunction: 'var(--khal-ease-spring)',
					transitionDuration: 'var(--khal-duration-normal)',
					...style,
				}}
				{...props}
			>
				{glow && (
					<div
						className="pointer-events-none absolute inset-0 rounded-[inherit]"
						style={{
							background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${glow} 20%, transparent), transparent 70%)`,
						}}
					/>
				)}
				<div className="relative">{children}</div>
			</div>
		);
	}
);
GlassCard.displayName = 'GlassCard';

export type { GlassCardProps };
export { GlassCard, glassCardVariants };
