'use client';

import { Archive, Copy, Download, Edit3, FolderPlus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FileEntry } from './schema';

export interface ContextMenuState {
	x: number;
	y: number;
	entry: FileEntry;
}

interface FilesContextMenuProps {
	state: ContextMenuState;
	currentPath: string;
	filesRoot: string;
	selectedNames: Set<string>;
	onClose: () => void;
	onRename: (entry: FileEntry) => void;
	onDelete: (entry: FileEntry) => void;
	onDownload: (entry: FileEntry) => void;
	onDownloadZip: (names: string[]) => void;
	onNewFolder: () => void;
}

export function FilesContextMenu({
	state,
	currentPath,
	filesRoot,
	selectedNames,
	onClose,
	onRename,
	onDelete,
	onDownload,
	onDownloadZip,
	onNewFolder,
}: FilesContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);

	const handleCopyPath = useCallback(() => {
		const relativePath = currentPath === '/' ? `/${state.entry.name}` : `${currentPath}/${state.entry.name}`;
		const absolutePath = filesRoot ? `${filesRoot}${relativePath}` : relativePath;
		navigator.clipboard.writeText(absolutePath);
		onClose();
	}, [currentPath, filesRoot, state.entry.name, onClose]);

	const handleRename = useCallback(() => {
		onRename(state.entry);
		onClose();
	}, [state.entry, onRename, onClose]);

	const handleDelete = useCallback(() => {
		onDelete(state.entry);
		onClose();
	}, [state.entry, onDelete, onClose]);

	const handleDownload = useCallback(() => {
		onDownload(state.entry);
		onClose();
	}, [state.entry, onDownload, onClose]);

	const handleDownloadZip = useCallback(() => {
		onDownloadZip([...selectedNames]);
		onClose();
	}, [selectedNames, onDownloadZip, onClose]);

	const handleNewFolder = useCallback(() => {
		onNewFolder();
		onClose();
	}, [onNewFolder, onClose]);

	// Close on Escape or click outside
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		const handleMouseDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('mousedown', handleMouseDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('mousedown', handleMouseDown);
		};
	}, [onClose]);

	// Adjust position to stay within viewport
	const style: React.CSSProperties = {
		position: 'fixed',
		left: state.x,
		top: state.y,
		zIndex: 9999,
		background: 'var(--os-menu-bg)',
		border: '1px solid var(--os-menu-border)',
		boxShadow: 'var(--os-menu-shadow)',
		color: 'var(--os-text-primary)',
	};

	return createPortal(
		<div
			ref={menuRef}
			className="min-w-[10rem] overflow-hidden rounded-xl p-1 animate-in fade-in-0 zoom-in-95"
			style={style}
		>
			<MenuItem icon={<Edit3 className="h-3.5 w-3.5" />} label="Rename" onClick={handleRename} />
			{!state.entry.isDir && (
				<MenuItem icon={<Download className="h-3.5 w-3.5" />} label="Download" onClick={handleDownload} />
			)}
			{selectedNames.size > 1 && (
				<MenuItem
					icon={<Archive className="h-3.5 w-3.5" />}
					label={`Download ${selectedNames.size} as Zip`}
					onClick={handleDownloadZip}
				/>
			)}
			<MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" onClick={handleDelete} destructive />
			<MenuItem icon={<Copy className="h-3.5 w-3.5" />} label="Copy Path" onClick={handleCopyPath} />
			<div className="-mx-1 my-1 h-px" style={{ background: 'var(--os-border-default)' }} />
			<MenuItem icon={<FolderPlus className="h-3.5 w-3.5" />} label="New Folder" onClick={handleNewFolder} />
		</div>,
		document.body
	);
}

function MenuItem({
	icon,
	label,
	onClick,
	destructive,
}: {
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
	destructive?: boolean;
}) {
	return (
		<button
			type="button"
			className="relative flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-copy-13 outline-none select-none transition-colors hover:bg-[var(--os-menu-hover)]"
			style={{ color: destructive ? 'var(--os-danger, #ef4444)' : 'var(--os-text-primary)' }}
			onClick={onClick}
		>
			{icon}
			{label}
		</button>
	);
}
