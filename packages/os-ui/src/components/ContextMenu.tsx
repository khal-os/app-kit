'use client';

import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import * as React from 'react';
import { cn } from '../utils';

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.Sub;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = React.forwardRef<
	React.ComponentRef<typeof ContextMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
		inset?: boolean;
	}
>(({ className, inset, children, ...props }, ref) => (
	<ContextMenuPrimitive.SubTrigger
		ref={ref}
		className={cn(
			'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-copy-13 outline-none select-none',
			'focus:bg-[var(--khal-menu-hover)]',
			'data-[state=open]:bg-[var(--khal-menu-hover)]',
			inset && 'pl-8',
			className
		)}
		style={{ color: 'var(--khal-text-primary)' }}
		{...props}
	>
		{children}
	</ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
	React.ComponentRef<typeof ContextMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
	<ContextMenuPrimitive.SubContent
		ref={ref}
		className={cn(
			'z-[9999] min-w-[8rem] overflow-hidden rounded-xl p-1',
			'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
			'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
			className
		)}
		style={{
			background: 'var(--khal-menu-bg)',
			border: '1px solid var(--khal-menu-border)',
			boxShadow: 'var(--khal-menu-shadow)',
			color: 'var(--khal-text-primary)',
		}}
		{...props}
	/>
));
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
	React.ComponentRef<typeof ContextMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
	<ContextMenuPrimitive.Portal>
		<ContextMenuPrimitive.Content
			ref={ref}
			className={cn(
				'z-[9999] min-w-[8rem] overflow-hidden rounded-xl p-1',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
				className
			)}
			style={{
				background: 'var(--khal-menu-bg)',
				border: '1px solid var(--khal-menu-border)',
				boxShadow: 'var(--khal-menu-shadow)',
				color: 'var(--khal-text-primary)',
			}}
			{...props}
		/>
	</ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
	React.ComponentRef<typeof ContextMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
		inset?: boolean;
	}
>(({ className, inset, ...props }, ref) => (
	<ContextMenuPrimitive.Item
		ref={ref}
		className={cn(
			'relative flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-copy-13 outline-none select-none transition-colors',
			'focus:bg-[var(--khal-menu-hover)]',
			'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
			inset && 'pl-8',
			className
		)}
		style={{ color: 'var(--khal-text-primary)' }}
		{...props}
	/>
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuSeparator = React.forwardRef<
	React.ComponentRef<typeof ContextMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<ContextMenuPrimitive.Separator
		ref={ref}
		className={cn('-mx-1 my-1 h-px', className)}
		style={{ background: 'var(--khal-border-default)' }}
		{...props}
	/>
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

export {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuRadioGroup,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
};
