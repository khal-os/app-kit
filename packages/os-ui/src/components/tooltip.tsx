'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';
import { cn } from '../utils';

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
	React.ComponentRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, style, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				'z-[9999] overflow-hidden rounded-md px-2.5 py-1 text-label-12',
				'animate-in fade-in-0 zoom-in-95',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
				'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
				className
			)}
			style={{
				background: 'var(--khal-text-primary, var(--ds-gray-1000))',
				color: 'var(--khal-text-inverse, var(--ds-background-100))',
				...style,
			}}
			{...props}
		/>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

interface SimpleTooltipProps {
	text: React.ReactNode;
	children: React.ReactNode;
	position?: 'top' | 'bottom' | 'left' | 'right';
	delay?: boolean;
	delayTime?: number;
	desktopOnly?: boolean;
	className?: string;
}

function Tooltip({ text, children, position = 'top', delay, delayTime, desktopOnly, className }: SimpleTooltipProps) {
	const delayDuration = delayTime ?? (delay ? 400 : 200);

	return (
		<TooltipProvider delayDuration={delayDuration}>
			<TooltipRoot>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent side={position} className={cn(desktopOnly && 'max-md:hidden', className)}>
					{text}
				</TooltipContent>
			</TooltipRoot>
		</TooltipProvider>
	);
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger };
