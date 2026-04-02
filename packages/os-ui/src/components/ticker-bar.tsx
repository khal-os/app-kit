'use client';

import type { ReactNode } from 'react';
import { cn } from '../utils';

interface TickerBarProps {
	/** Items to scroll — rendered twice for seamless looping */
	children: ReactNode;
	/** Animation duration in seconds (default 30) */
	duration?: number;
	/** Pause on hover */
	pauseOnHover?: boolean;
	className?: string;
}

function TickerBar({ children, duration = 30, pauseOnHover = true, className }: TickerBarProps) {
	return (
		<div
			className={cn('relative w-full overflow-hidden', className)}
			style={{
				maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
				WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
			}}
		>
			<div
				className={cn('flex w-max', pauseOnHover && 'hover:[animation-play-state:paused]')}
				style={{
					animation: `khal-ticker ${duration}s linear infinite`,
				}}
			>
				<div className="flex shrink-0 items-center">{children}</div>
				<div className="flex shrink-0 items-center" aria-hidden>
					{children}
				</div>
			</div>
		</div>
	);
}

export type { TickerBarProps };
export { TickerBar };
