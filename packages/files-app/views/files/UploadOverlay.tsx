'use client';

import { Upload } from 'lucide-react';
import type { UploadState } from './use-upload';

interface UploadOverlayProps {
	/** True when the user is dragging files over the drop zone */
	isDragging: boolean;
	/** Current upload state from useUpload */
	uploadState: UploadState;
}

export function UploadOverlay({ isDragging, uploadState }: UploadOverlayProps) {
	if (!isDragging && !uploadState.uploading && !uploadState.error) {
		return null;
	}

	// Drag overlay — shown while files hover over the drop zone
	if (isDragging) {
		return (
			<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-md border-2 border-dashed border-blue-700 bg-blue-700/10">
				<div className="flex flex-col items-center gap-2 text-blue-700">
					<Upload className="h-8 w-8" />
					<span className="text-label-14 font-medium">Drop files to upload</span>
				</div>
			</div>
		);
	}

	// Upload progress
	if (uploadState.uploading) {
		return (
			<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background-100/80">
				<div className="flex w-64 flex-col items-center gap-3 rounded-lg border border-gray-alpha-200 bg-background-100 p-6 shadow-lg">
					<Upload className="h-6 w-6 text-blue-700" />
					<span className="truncate text-label-13 text-gray-1000">{uploadState.fileName}</span>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-alpha-200">
						<div
							className="h-full rounded-full bg-blue-700 transition-all duration-200"
							style={{ width: `${uploadState.progress}%` }}
						/>
					</div>
					<span className="text-label-13 text-gray-700">{uploadState.progress}%</span>
				</div>
			</div>
		);
	}

	// Error state
	if (uploadState.error) {
		return (
			<div className="pointer-events-none absolute bottom-3 left-3 right-3 z-30">
				<div className="rounded-md border border-red-400/30 bg-red-50 px-3 py-2 text-label-13 text-red-700 dark:bg-red-900/20 dark:text-red-400">
					Upload failed: {uploadState.error}
				</div>
			</div>
		);
	}

	return null;
}
