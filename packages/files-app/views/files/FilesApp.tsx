'use client';

import { AlertTriangle, FolderOpen, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/os-primitives/empty-state';
import { StatusBar } from '@/components/os-primitives/status-bar';
import { Spinner } from '@/components/ui/spinner';
import { validateFilename } from '@/lib/files/filename-validation';
import { type ContextMenuState, FilesContextMenu } from './ContextMenu';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { FilesListView } from './FilesListView';
import { FilesToolbar, type ViewMode } from './FilesToolbar';
import { GridView } from './GridView';
import type { FileEntry } from './schema';
import { UploadOverlay } from './UploadOverlay';
import { useFiles } from './use-files';
import { useUpload } from './use-upload';

const VIEW_MODE_KEY = 'genie-os-files-view-mode';

function getStoredViewMode(): ViewMode {
	if (typeof window === 'undefined') return 'grid';
	const stored = localStorage.getItem(VIEW_MODE_KEY);
	if (stored === 'grid' || stored === 'list') return stored;
	return 'grid';
}

export function FilesApp(_props: { windowId: string; meta?: Record<string, unknown> }) {
	const {
		currentPath,
		filesRoot,
		entries,
		loading,
		error: fetchError,
		navigateTo,
		refresh,
		goBack,
		goUp,
		canGoBack,
		writeOp,
	} = useFiles();

	const { uploadState, uploadFiles, clearError: clearUploadError } = useUpload(currentPath, refresh);

	const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);
	const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [renamingName, setRenamingName] = useState<string | null>(null);
	const [creatingFolder, setCreatingFolder] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	const error = fetchError || localError;

	// Track last-clicked item for shift-click range selection
	const lastClickedRef = useRef<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragCounterRef = useRef(0);

	// Persist view mode to localStorage
	const handleViewModeChange = useCallback((mode: ViewMode) => {
		setViewMode(mode);
		localStorage.setItem(VIEW_MODE_KEY, mode);
	}, []);

	// Clear selection and local errors when path changes
	useEffect(() => {
		setSelectedNames(new Set());
		setRenamingName(null);
		setContextMenu(null);
		setLocalError(null);
		lastClickedRef.current = null;
	}, [currentPath]);

	// Navigate into a directory entry
	const handleNavigate = useCallback(
		(entry: FileEntry) => {
			if (entry.isDir) {
				const targetPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
				navigateTo(targetPath);
			}
		},
		[currentPath, navigateTo]
	);

	// Multi-select click handler
	const handleSelect = useCallback(
		(name: string, e: React.MouseEvent) => {
			const metaKey = e.metaKey || e.ctrlKey;
			const shiftKey = e.shiftKey;

			if (shiftKey && lastClickedRef.current) {
				// Range select from lastClicked to current
				const names = entries.map((en) => en.name);
				const lastIdx = names.indexOf(lastClickedRef.current);
				const currIdx = names.indexOf(name);
				if (lastIdx !== -1 && currIdx !== -1) {
					const start = Math.min(lastIdx, currIdx);
					const end = Math.max(lastIdx, currIdx);
					const rangeNames = names.slice(start, end + 1);
					setSelectedNames((prev) => {
						const next = new Set(prev);
						for (const n of rangeNames) next.add(n);
						return next;
					});
				}
			} else if (metaKey) {
				// Toggle individual item
				setSelectedNames((prev) => {
					const next = new Set(prev);
					if (next.has(name)) {
						next.delete(name);
					} else {
						next.add(name);
					}
					return next;
				});
				lastClickedRef.current = name;
			} else {
				// Single select
				setSelectedNames(new Set([name]));
				lastClickedRef.current = name;
			}
		},
		[entries]
	);

	// Clear selection on background click
	const handleClearSelection = useCallback(() => {
		setSelectedNames(new Set());
		lastClickedRef.current = null;
	}, []);

	// Context menu handler
	const handleContextMenu = useCallback(
		(e: React.MouseEvent, entry: FileEntry) => {
			e.preventDefault();
			// If right-clicked item is not in selection, select only it
			if (!selectedNames.has(entry.name)) {
				setSelectedNames(new Set([entry.name]));
				lastClickedRef.current = entry.name;
			}
			setContextMenu({ x: e.clientX, y: e.clientY, entry });
		},
		[selectedNames]
	);

	const handleCloseContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	// New folder: show inline input
	const handleNewFolder = useCallback(() => {
		setCreatingFolder(true);
	}, []);

	// New folder: submit name from inline input
	const handleNewFolderSubmit = useCallback(
		async (name: string) => {
			setCreatingFolder(false);
			if (!name.trim()) return;
			const trimmed = name.trim();
			const nameError = validateFilename(trimmed);
			if (nameError) {
				setLocalError(nameError);
				return;
			}
			const folderPath = currentPath === '/' ? `/${trimmed}` : `${currentPath}/${trimmed}`;
			await writeOp({ op: 'mkdir', path: folderPath });
		},
		[currentPath, writeOp]
	);

	// Upload: open file picker
	const handleUploadClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				uploadFiles(e.target.files);
			}
			// Reset input so the same file can be selected again
			e.target.value = '';
		},
		[uploadFiles]
	);

	// Drag & drop handlers
	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			dragCounterRef.current++;
			if (e.dataTransfer.types.includes('Files')) {
				setIsDragging(true);
				clearUploadError();
			}
		},
		[clearUploadError]
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current--;
		if (dragCounterRef.current === 0) {
			setIsDragging(false);
		}
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			dragCounterRef.current = 0;
			setIsDragging(false);
			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				uploadFiles(e.dataTransfer.files);
			}
		},
		[uploadFiles]
	);

	// Download single file
	const handleDownload = useCallback(
		(entry: FileEntry) => {
			if (entry.isDir) return;
			const filePath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
			window.open(`/api/files/download?path=${encodeURIComponent(filePath)}`, '_blank');
		},
		[currentPath]
	);

	// Download multiple files as zip
	const handleDownloadZip = useCallback(
		async (names: string[]) => {
			if (names.length === 0) return;
			const paths = names.map((name) => (currentPath === '/' ? `/${name}` : `${currentPath}/${name}`));

			try {
				const response = await fetch('/api/files/download-zip', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ paths }),
				});

				if (!response.ok) {
					const body = await response.json().catch(() => null);
					setLocalError(body?.error || `Download failed (${response.status})`);
					return;
				}

				const blob = await response.blob();
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'download.zip';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			} catch (err) {
				setLocalError((err as Error).message || 'Download failed');
			}
		},
		[currentPath]
	);

	// Rename: set the renaming state
	const handleRenameStart = useCallback((entry: FileEntry) => {
		setRenamingName(entry.name);
	}, []);

	// Rename submit: call writeOp
	const handleRenameSubmit = useCallback(
		async (oldName: string, newName: string) => {
			setRenamingName(null);
			if (!newName.trim() || newName === oldName) return;
			const trimmed = newName.trim();
			const nameError = validateFilename(trimmed);
			if (nameError) {
				setLocalError(nameError);
				return;
			}
			const fullPath = currentPath === '/' ? `/${oldName}` : `${currentPath}/${oldName}`;
			await writeOp({ op: 'rename', path: fullPath, newName: trimmed });
		},
		[currentPath, writeOp]
	);

	// Delete: show confirmation dialog
	const handleDelete = useCallback((entry: FileEntry) => {
		setPendingDelete([entry.name]);
	}, []);

	// Ref for the main content area (for keyboard focus)
	const contentRef = useRef<HTMLDivElement>(null);

	// Keyboard: delete selected items — show confirmation dialog
	const handleKeyDelete = useCallback(() => {
		if (selectedNames.size === 0) return;
		const names = entries.filter((en) => selectedNames.has(en.name)).map((en) => en.name);
		if (names.length === 0) return;
		setPendingDelete(names);
	}, [selectedNames, entries]);

	// Execute pending delete after confirmation
	const handleDeleteConfirm = useCallback(() => {
		if (!pendingDelete) return;
		for (const name of pendingDelete) {
			const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
			writeOp({ op: 'delete', path: fullPath });
		}
		setPendingDelete(null);
		setSelectedNames(new Set());
	}, [pendingDelete, currentPath, writeOp]);

	const handleDeleteCancel = useCallback(() => {
		setPendingDelete(null);
	}, []);

	// Keyboard: rename single selected item
	const handleKeyRename = useCallback(() => {
		if (selectedNames.size === 1) setRenamingName([...selectedNames][0]);
	}, [selectedNames]);

	// Keyboard: open selected directory
	const handleKeyEnter = useCallback(() => {
		if (selectedNames.size !== 1) return;
		const entry = entries.find((en) => en.name === [...selectedNames][0]);
		if (entry?.isDir) handleNavigate(entry);
	}, [selectedNames, entries, handleNavigate]);

	// Keyboard: select all
	const handleKeySelectAll = useCallback(() => {
		setSelectedNames(new Set(entries.map((en) => en.name)));
	}, [entries]);

	// Keyboard: clear selection
	const handleKeyClear = useCallback(() => {
		setSelectedNames(new Set());
		lastClickedRef.current = null;
	}, []);

	// Keyboard navigation dispatcher
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (renamingName || creatingFolder) return;
			const handlers: Record<string, () => void> = {
				Escape: handleKeyClear,
				Delete: handleKeyDelete,
				Backspace: handleKeyDelete,
				F2: handleKeyRename,
				Enter: handleKeyEnter,
			};
			const handler = handlers[e.key];
			if (handler) {
				e.preventDefault();
				handler();
				return;
			}
			if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleKeySelectAll();
			}
		},
		[renamingName, creatingFolder, handleKeyClear, handleKeyDelete, handleKeyRename, handleKeyEnter, handleKeySelectAll]
	);

	// Item count text
	const dirCount = entries.filter((e) => e.isDir).length;
	const fileCount = entries.length - dirCount;

	const statusText = (() => {
		const parts: string[] = [];
		if (dirCount > 0) parts.push(`${dirCount} folder${dirCount !== 1 ? 's' : ''}`);
		if (fileCount > 0) parts.push(`${fileCount} file${fileCount !== 1 ? 's' : ''}`);
		if (parts.length === 0) return 'Empty';
		const selCount = selectedNames.size;
		if (selCount > 0) return `${parts.join(', ')} (${selCount} selected)`;
		return parts.join(', ');
	})();

	return (
		<div
			className="relative flex h-full flex-col bg-background-100 text-gray-1000"
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
			<UploadOverlay isDragging={isDragging} uploadState={uploadState} />
			<FilesToolbar
				currentPath={currentPath}
				canGoBack={canGoBack}
				viewMode={viewMode}
				loading={loading}
				onGoBack={goBack}
				onGoUp={goUp}
				onNavigateTo={navigateTo}
				onViewModeChange={handleViewModeChange}
				onNewFolder={handleNewFolder}
				onUpload={handleUploadClick}
				onRefresh={refresh}
			/>

			{/* Main content area */}
			<div
				ref={contentRef}
				className="flex-1 overflow-hidden outline-none"
				tabIndex={0}
				onKeyDown={handleKeyDown}
				role="toolbar"
			>
				{loading && entries.length === 0 ? (
					<div className="flex h-full items-center justify-center">
						<Spinner size="lg" className="text-gray-700" />
					</div>
				) : error ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							icon={<AlertTriangle />}
							title="Error"
							description={error}
							action={
								<button
									type="button"
									onClick={refresh}
									className="inline-flex items-center gap-1.5 rounded-lg border border-gray-alpha-400 bg-background-100 px-3 py-1.5 text-label-13 text-gray-1000 transition-colors hover:bg-gray-alpha-100"
								>
									<RefreshCw className="h-3.5 w-3.5" />
									Retry
								</button>
							}
						/>
					</div>
				) : entries.length === 0 && !creatingFolder ? (
					<div className="flex h-full items-center justify-center p-8">
						<EmptyState
							icon={<FolderOpen />}
							title="This folder is empty"
							description="Create a new folder or upload files to get started."
						/>
					</div>
				) : viewMode === 'grid' ? (
					<GridView
						entries={entries}
						selectedNames={selectedNames}
						onSelect={handleSelect}
						onClearSelection={handleClearSelection}
						onNavigate={handleNavigate}
						onContextMenu={handleContextMenu}
						renamingName={renamingName}
						onRenameSubmit={handleRenameSubmit}
						creatingFolder={creatingFolder}
						onNewFolderSubmit={handleNewFolderSubmit}
					/>
				) : (
					<FilesListView
						entries={entries}
						selectedNames={selectedNames}
						onSelect={handleSelect}
						onClearSelection={handleClearSelection}
						onNavigate={handleNavigate}
						onContextMenu={handleContextMenu}
						renamingName={renamingName}
						onRenameSubmit={handleRenameSubmit}
						creatingFolder={creatingFolder}
						onNewFolderSubmit={handleNewFolderSubmit}
					/>
				)}
			</div>

			<StatusBar>
				<StatusBar.Item>{statusText}</StatusBar.Item>
				<StatusBar.Spacer />
				<StatusBar.Item>{currentPath}</StatusBar.Item>
			</StatusBar>

			{contextMenu && (
				<FilesContextMenu
					state={contextMenu}
					currentPath={currentPath}
					filesRoot={filesRoot}
					selectedNames={selectedNames}
					onClose={handleCloseContextMenu}
					onRename={handleRenameStart}
					onDelete={handleDelete}
					onDownload={handleDownload}
					onDownloadZip={handleDownloadZip}
					onNewFolder={handleNewFolder}
				/>
			)}

			{pendingDelete && (
				<DeleteConfirmDialog names={pendingDelete} onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} />
			)}
		</div>
	);
}
