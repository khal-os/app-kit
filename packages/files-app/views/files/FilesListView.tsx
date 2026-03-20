'use client';

import { ArrowDown, ArrowUp, Folder } from 'lucide-react';
import { useCallback, useState } from 'react';
import { formatDate, formatSize, getFileIcon } from './FileItem';
import { InlineRenameInput, NewFolderInput } from './InlineInput';
import type { FileEntry } from './schema';

type SortColumn = 'name' | 'size' | 'mtime';
type SortDirection = 'asc' | 'desc';

function sortEntries(entries: FileEntry[], column: SortColumn, direction: SortDirection): FileEntry[] {
	return [...entries].sort((a, b) => {
		// Directories always first
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;

		let cmp: number;
		switch (column) {
			case 'name':
				cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
				break;
			case 'size':
				cmp = a.size - b.size;
				break;
			case 'mtime':
				cmp = a.mtime - b.mtime;
				break;
			default:
				cmp = 0;
		}

		return direction === 'asc' ? cmp : -cmp;
	});
}

interface FilesListViewProps {
	entries: FileEntry[];
	selectedNames: Set<string>;
	onSelect: (name: string, e: React.MouseEvent) => void;
	onClearSelection: () => void;
	onNavigate: (entry: FileEntry) => void;
	onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
	renamingName: string | null;
	onRenameSubmit: (oldName: string, newName: string) => void;
	creatingFolder: boolean;
	onNewFolderSubmit: (name: string) => void;
}

export function FilesListView({
	entries,
	selectedNames,
	onSelect,
	onClearSelection,
	onNavigate,
	onContextMenu,
	renamingName,
	onRenameSubmit,
	creatingFolder,
	onNewFolderSubmit,
}: FilesListViewProps) {
	const [sortColumn, setSortColumn] = useState<SortColumn>('name');
	const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

	const sortedEntries = sortEntries(entries, sortColumn, sortDirection);

	const handleSort = useCallback(
		(column: SortColumn) => {
			if (sortColumn === column) {
				setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
			} else {
				setSortColumn(column);
				setSortDirection('asc');
			}
		},
		[sortColumn]
	);

	const handleDoubleClick = useCallback(
		(entry: FileEntry) => {
			if (entry.isDir) {
				onNavigate(entry);
			}
		},
		[onNavigate]
	);

	const SortIcon = useCallback(
		({ column }: { column: SortColumn }) => {
			if (sortColumn !== column) return null;
			return sortDirection === 'asc' ? (
				<ArrowUp className="ml-0.5 inline h-3 w-3" />
			) : (
				<ArrowDown className="ml-0.5 inline h-3 w-3" />
			);
		},
		[sortColumn, sortDirection]
	);

	return (
		<div className="h-full overflow-y-auto" onClick={onClearSelection} onKeyDown={undefined} role="presentation">
			<table className="w-full border-collapse text-label-13">
				<thead className="sticky top-0 z-10 bg-background-100">
					<tr className="border-b border-gray-alpha-200">
						<th className="px-3 py-1.5 text-left font-medium text-gray-800">
							<button
								type="button"
								className="inline-flex items-center transition-colors hover:text-gray-1000"
								onClick={(e) => {
									e.stopPropagation();
									handleSort('name');
								}}
							>
								Name
								<SortIcon column="name" />
							</button>
						</th>
						<th className="w-24 px-3 py-1.5 text-right font-medium text-gray-800">
							<button
								type="button"
								className="inline-flex items-center transition-colors hover:text-gray-1000"
								onClick={(e) => {
									e.stopPropagation();
									handleSort('size');
								}}
							>
								Size
								<SortIcon column="size" />
							</button>
						</th>
						<th className="w-32 px-3 py-1.5 text-right font-medium text-gray-800">
							<button
								type="button"
								className="inline-flex items-center transition-colors hover:text-gray-1000"
								onClick={(e) => {
									e.stopPropagation();
									handleSort('mtime');
								}}
							>
								Modified
								<SortIcon column="mtime" />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{creatingFolder && (
						<tr className="cursor-default border-b border-gray-alpha-100 bg-blue-700/15">
							<td className="px-3 py-1.5">
								<div className="flex items-center gap-2">
									<Folder className="h-4 w-4 shrink-0 text-blue-700" strokeWidth={1.5} />
									<NewFolderInput onSubmit={onNewFolderSubmit} />
								</div>
							</td>
							<td className="px-3 py-1.5 text-right text-gray-800">--</td>
							<td className="px-3 py-1.5 text-right text-gray-800">--</td>
						</tr>
					)}
					{sortedEntries.map((entry) => {
						const Icon = getFileIcon(entry);
						const isSelected = selectedNames.has(entry.name);
						const isRenaming = renamingName === entry.name;

						return (
							<tr
								key={entry.name}
								className={`cursor-default border-b border-gray-alpha-100 transition-colors ${
									isSelected ? 'bg-blue-700/15' : 'hover:bg-gray-alpha-100'
								}`}
								onClick={(e) => {
									e.stopPropagation();
									onSelect(entry.name, e);
								}}
								onDoubleClick={() => handleDoubleClick(entry)}
								onContextMenu={(e) => {
									e.stopPropagation();
									onContextMenu(e, entry);
								}}
							>
								<td className="px-3 py-1.5">
									<div className="flex items-center gap-2">
										<Icon
											className={`h-4 w-4 shrink-0 ${entry.isDir ? 'text-blue-700' : 'text-gray-700'}`}
											strokeWidth={1.5}
										/>
										{isRenaming ? (
											<InlineRenameInput name={entry.name} onSubmit={onRenameSubmit} />
										) : (
											<span className="truncate text-gray-1000">{entry.name}</span>
										)}
									</div>
								</td>
								<td className="px-3 py-1.5 text-right text-gray-800">{entry.isDir ? '--' : formatSize(entry.size)}</td>
								<td className="px-3 py-1.5 text-right text-gray-800">{formatDate(entry.mtime)}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
