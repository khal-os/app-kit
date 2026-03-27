'use client';

import { motion, useInView } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '../utils';
import { NumberFlow } from './number-flow';

interface CostCounterProps {
	/** The target numeric value to animate to */
	value: number;
	/** Text suffix after the number (e.g. "%", "pts", "k") */
	suffix?: string;
	/** Text prefix before the number (e.g. "$", "+") */
	prefix?: string;
	/** Primary label below the number */
	label: string;
	/** Secondary description text */
	description?: string;
	/** Budget bar target percentage (0-100). Omit to hide the bar. */
	budget?: number;
	/** Budget bar color — defaults to accent-warm */
	budgetColor?: string;
	className?: string;
}

function CostCounter({ value, suffix, prefix, label, description, budget, budgetColor, className }: CostCounterProps) {
	const [displayed, setDisplayed] = useState(0);
	const triggered = useRef(false);
	const barRef = useRef<HTMLDivElement>(null);
	const barInView = useInView(barRef, { once: true, amount: 0.6 });

	const handleViewport = useCallback(() => {
		if (!triggered.current) {
			triggered.current = true;
			setDisplayed(value);
		}
	}, [value]);

	return (
		<motion.div
			onViewportEnter={handleViewport}
			viewport={{ once: true, amount: 0.5 }}
			className={cn('flex flex-col gap-3', className)}
		>
			<div
				className="flex items-baseline tabular-nums font-semibold tracking-tight leading-none"
				style={{ fontFamily: 'var(--font-display, var(--font-geist-sans))' }}
			>
				{prefix && <span className="text-[0.7em]">{prefix}</span>}
				<NumberFlow value={displayed} />
				{suffix && <span className="text-[0.65em] ml-0.5 opacity-70">{suffix}</span>}
			</div>

			{budget != null && (
				<div ref={barRef} className="w-full h-2 rounded-full overflow-hidden bg-[var(--ds-gray-alpha-200)]">
					<motion.div
						initial={{ width: 0 }}
						animate={barInView ? { width: `${Math.min(budget, 100)}%` } : { width: 0 }}
						transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
						className="h-full rounded-full"
						style={{ backgroundColor: budgetColor ?? 'var(--ds-accent-warm)' }}
					/>
				</div>
			)}

			<div className="flex flex-col gap-0.5">
				<span className="text-sm font-medium leading-5">{label}</span>
				{description && <span className="text-xs opacity-50 leading-4">{description}</span>}
			</div>
		</motion.div>
	);
}

export type { CostCounterProps };
export { CostCounter };
