'use client';

import { Toolbar } from '@khal-os/ui';
import { ChevronLeft, ChevronRight, FolderPlus, Grid, List, RefreshCw, Upload } from 'lucide-react';
import { useCallback } from 'react';

export type ViewMode = 'grid' | 'list';

interface FilesToolbarProps {
	currentPath: string;
	canGoBack: boolean;
	viewMode: ViewMode;
	loading: boolean;
	onGoBack: () => void;
	onGoUp: () => void;
	onNavigateTo: (path: string) => void;
	onViewModeChange: (mode: ViewMode) => void;
	onNewFolder: () => void;
	onUpload: () => void;
	onRefresh: () => void;
}

export function FilesToolbar({
	currentPath,
	canGoBack,
	viewMode,
	loading,
	onGoBack,
	onGoUp,
	onNavigateTo,
	onViewModeChange,
	onNewFolder,
	onUpload,
	onRefresh,
}: FilesToolbarProps) {
	const segments = currentPath.split('/').filter(Boolean);

	const handleBreadcrumbClick = useCallback(
		(index: number) => {
			const path = `/${segments.slice(0, index + 1).join('/')}`;
			onNavigateTo(path);
		},
		[segments, onNavigateTo]
	);

	const handleRootClick = useCallback(() => {
		onNavigateTo('/');
	}, [onNavigateTo]);

	return (
		<Toolbar>
			<Toolbar.Group>
				<Toolbar.Button tooltip="Back" onClick={onGoBack} disabled={!canGoBack}>
					<ChevronLeft />
				</Toolbar.Button>
				<Toolbar.Button tooltip="Up" onClick={onGoUp} disabled={currentPath === '/'}>
					<ChevronRight />
				</Toolbar.Button>
			</Toolbar.Group>

			<Toolbar.Separator />

			{/* Breadcrumb */}
			<div className="flex items-center gap-0.5 overflow-hidden text-label-13">
				<button
					type="button"
					onClick={handleRootClick}
					className="shrink-0 rounded-sm px-1 py-0.5 text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000"
				>
					~
				</button>
				{segments.map((segment, i) => (
					<span key={`/${segments.slice(0, i + 1).join('/')}`} className="flex items-center gap-0.5">
						<span className="text-gray-600">/</span>
						<button
							type="button"
							onClick={() => handleBreadcrumbClick(i)}
							className={`truncate rounded-sm px-1 py-0.5 transition-colors hover:bg-gray-alpha-200 ${
								i === segments.length - 1 ? 'font-medium text-gray-1000' : 'text-gray-900 hover:text-gray-1000'
							}`}
						>
							{segment}
						</button>
					</span>
				))}
			</div>

			<Toolbar.Spacer />

			<Toolbar.Group>
				<Toolbar.Button tooltip="Grid view" active={viewMode === 'grid'} onClick={() => onViewModeChange('grid')}>
					<Grid />
				</Toolbar.Button>
				<Toolbar.Button tooltip="List view" active={viewMode === 'list'} onClick={() => onViewModeChange('list')}>
					<List />
				</Toolbar.Button>
			</Toolbar.Group>

			<Toolbar.Separator />

			<Toolbar.Group>
				<Toolbar.Button tooltip="New Folder" onClick={onNewFolder}>
					<FolderPlus />
				</Toolbar.Button>
				<Toolbar.Button tooltip="Upload" onClick={onUpload}>
					<Upload />
				</Toolbar.Button>
			</Toolbar.Group>

			<Toolbar.Separator />

			<Toolbar.Button tooltip="Refresh" onClick={onRefresh} active={loading}>
				<RefreshCw />
			</Toolbar.Button>
		</Toolbar>
	);
}
