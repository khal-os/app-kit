'use client';

import { Filter, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { Priority } from '../types';

interface PipelineToolbarProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	priorityFilter: Priority | null;
	onPriorityChange: (priority: Priority | null) => void;
	assigneeFilter: string | null;
	onAssigneeChange: (assignee: string | null) => void;
	assignees: string[];
	onRefresh: () => void;
}

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

export function PipelineToolbar({
	searchQuery,
	onSearchChange,
	priorityFilter,
	onPriorityChange,
	assigneeFilter,
	onAssigneeChange,
	assignees,
	onRefresh,
}: PipelineToolbarProps) {
	const [localQuery, setLocalQuery] = useState(searchQuery);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleSearchInput = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setLocalQuery(value);
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => onSearchChange(value), 300);
		},
		[onSearchChange]
	);

	const clearSearch = useCallback(() => {
		setLocalQuery('');
		onSearchChange('');
	}, [onSearchChange]);

	useEffect(() => {
		return () => clearTimeout(timerRef.current);
	}, []);

	const hasFilters = !!priorityFilter || !!assigneeFilter;

	return (
		<div
			className="flex h-10 shrink-0 items-center gap-2 border-b px-3"
			style={{ borderColor: 'var(--khal-border-default)' }}
		>
			{/* Search */}
			<div className="relative flex-1">
				<Search
					className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
					style={{ color: 'var(--khal-text-muted)' }}
				/>
				<Input
					value={localQuery}
					onChange={handleSearchInput}
					placeholder="Search items..."
					size="small"
					className="h-7 pl-7 pr-7 text-[12px]"
				/>
				{localQuery && (
					<button
						type="button"
						onClick={clearSearch}
						className="absolute right-2 top-1/2 -translate-y-1/2"
						style={{ color: 'var(--khal-text-muted)' }}
					>
						<X className="h-3.5 w-3.5" />
					</button>
				)}
			</div>

			{/* Priority filter */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="small" className="h-7 gap-1.5 px-2 text-[12px]">
						<Filter className="h-3.5 w-3.5" />
						Priority
						{priorityFilter && (
							<span
								className="rounded-full px-1.5 text-[10px] font-medium"
								style={{
									backgroundColor: 'var(--khal-surface-raised)',
									color: 'var(--khal-text-primary)',
								}}
							>
								{priorityFilter}
							</span>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuLabel>Priority</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{PRIORITIES.map((p) => (
						<DropdownMenuCheckboxItem
							key={p}
							checked={priorityFilter === p}
							onCheckedChange={(checked) => onPriorityChange(checked ? p : null)}
						>
							{p.charAt(0).toUpperCase() + p.slice(1)}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Assignee filter */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="small" className="h-7 gap-1.5 px-2 text-[12px]">
						Assignee
						{assigneeFilter && (
							<span
								className="rounded-full px-1.5 text-[10px] font-medium"
								style={{
									backgroundColor: 'var(--khal-surface-raised)',
									color: 'var(--khal-text-primary)',
								}}
							>
								{assigneeFilter}
							</span>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuLabel>Assignee</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{assignees.map((name) => (
						<DropdownMenuCheckboxItem
							key={name}
							checked={assigneeFilter === name}
							onCheckedChange={(checked) => onAssigneeChange(checked ? name : null)}
						>
							{name}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Clear filters */}
			{hasFilters && (
				<Button
					variant="ghost"
					size="small"
					className="h-7 px-2 text-[12px]"
					onClick={() => {
						onPriorityChange(null);
						onAssigneeChange(null);
					}}
				>
					<X className="mr-1 h-3 w-3" />
					Clear
				</Button>
			)}

			{/* Refresh */}
			<Button variant="ghost" size="small" className="h-7 w-7 p-0" onClick={onRefresh}>
				<RefreshCw className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}
