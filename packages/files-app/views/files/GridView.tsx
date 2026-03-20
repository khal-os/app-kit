'use client';

import { Folder } from 'lucide-react';
import { useCallback } from 'react';
import { formatSize, getFileIcon } from './FileItem';
import { InlineRenameInput, NewFolderInput } from './InlineInput';
import type { FileEntry } from './schema';

interface GridViewProps {
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

export function GridView({
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
}: GridViewProps) {
	const handleDoubleClick = useCallback(
		(entry: FileEntry) => {
			if (entry.isDir) {
				onNavigate(entry);
			}
		},
		[onNavigate]
	);

	return (
		<div className="h-full overflow-y-auto p-3" onClick={onClearSelection} onKeyDown={undefined} role="presentation">
			<div
				className="grid auto-rows-auto gap-1"
				style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}
			>
				{creatingFolder && (
					<div className="flex cursor-default flex-col items-center gap-1 rounded-lg bg-blue-700/15 p-2">
						<Folder className="h-8 w-8 text-blue-700" strokeWidth={1.5} />
						<NewFolderInput onSubmit={onNewFolderSubmit} className="text-center" />
					</div>
				)}
				{entries.map((entry) => {
					const Icon = getFileIcon(entry);
					const isSelected = selectedNames.has(entry.name);
					const isRenaming = renamingName === entry.name;

					return (
						<button
							type="button"
							key={entry.name}
							className={`flex cursor-default flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
								isSelected ? 'bg-blue-700/15 text-gray-1000' : 'text-gray-1000 hover:bg-gray-alpha-100'
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
							<Icon className={`h-8 w-8 ${entry.isDir ? 'text-blue-700' : 'text-gray-700'}`} strokeWidth={1.5} />
							{isRenaming ? (
								<InlineRenameInput name={entry.name} onSubmit={onRenameSubmit} className="text-center" />
							) : (
								<span className="w-full truncate text-center text-label-13">{entry.name}</span>
							)}
							{!entry.isDir && <span className="text-[11px] text-gray-700">{formatSize(entry.size)}</span>}
						</button>
					);
				})}
			</div>
		</div>
	);
}
