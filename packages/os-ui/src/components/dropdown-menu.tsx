'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as React from 'react';
import { cn } from '../utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
		inset?: boolean;
	}
>(({ className, inset, children, ...props }, ref) => (
	<DropdownMenuPrimitive.SubTrigger
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
	</DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.SubContent
		ref={ref}
		className={cn(
			'z-[9999] min-w-[8rem] overflow-hidden rounded-xl p-1',
			'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
			'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
			'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
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
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				'z-[9999] min-w-[8rem] overflow-hidden rounded-xl p-1',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
				'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
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
	</DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
		inset?: boolean;
		prefix?: React.ReactNode;
		suffix?: React.ReactNode;
	}
>(({ className, inset, prefix, suffix, children, ...props }, ref) => (
	<DropdownMenuPrimitive.Item
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
	>
		{prefix && <span className="inline-flex shrink-0">{prefix}</span>}
		{children}
		{suffix && (
			<span className="ml-auto inline-flex shrink-0" style={{ color: 'var(--khal-text-muted)' }}>
				{suffix}
			</span>
		)}
	</DropdownMenuPrimitive.Item>
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
	<DropdownMenuPrimitive.CheckboxItem
		ref={ref}
		className={cn(
			'relative flex cursor-default items-center rounded-lg py-1.5 pl-8 pr-2 text-copy-13 outline-none select-none transition-colors',
			'focus:bg-[var(--khal-menu-hover)]',
			'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
			className
		)}
		style={{ color: 'var(--khal-text-primary)' }}
		checked={checked}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<DropdownMenuPrimitive.ItemIndicator>
				<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3354 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.5553 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
						fill="currentColor"
						fillRule="evenodd"
						clipRule="evenodd"
					></path>
				</svg>
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
	<DropdownMenuPrimitive.RadioItem
		ref={ref}
		className={cn(
			'relative flex cursor-default items-center rounded-lg py-1.5 pl-8 pr-2 text-copy-13 outline-none select-none transition-colors',
			'focus:bg-[var(--khal-menu-hover)]',
			'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
			className
		)}
		style={{ color: 'var(--khal-text-primary)' }}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<DropdownMenuPrimitive.ItemIndicator>
				<svg width="8" height="8" viewBox="0 0 8 8" fill="none">
					<circle cx="4" cy="4" r="4" fill="currentColor" />
				</svg>
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
		inset?: boolean;
	}
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Label
		ref={ref}
		className={cn('px-2 py-1.5 text-label-12 font-semibold', inset && 'pl-8', className)}
		style={{ color: 'var(--khal-text-secondary)' }}
		{...props}
	/>
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.Separator
		ref={ref}
		className={cn('-mx-1 my-1 h-px', className)}
		style={{ background: 'var(--khal-border-default)' }}
		{...props}
	/>
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn('ml-auto text-label-12 tracking-widest', className)}
			style={{ color: 'var(--khal-text-muted)' }}
			{...props}
		/>
	);
};

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
};
