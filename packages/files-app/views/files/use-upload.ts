'use client';

import { useCallback, useState } from 'react';

export interface UploadState {
	uploading: boolean;
	progress: number; // 0-100
	fileName: string | null;
	error: string | null;
}

const INITIAL_STATE: UploadState = {
	uploading: false,
	progress: 0,
	fileName: null,
	error: null,
};

function uploadFile(file: File, targetPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const formData = new FormData();
		formData.append('file', file);
		formData.append('path', targetPath);

		xhr.open('POST', '/api/files/upload');

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const response = JSON.parse(xhr.responseText);
					if (response.ok) {
						resolve();
					} else {
						reject(new Error(response.error || 'Upload failed'));
					}
				} catch {
					reject(new Error('Invalid server response'));
				}
			} else {
				reject(new Error(`Upload failed (${xhr.status})`));
			}
		};

		xhr.onerror = () => {
			reject(new Error('Network error'));
		};

		xhr.send(formData);
	});
}

export function useUpload(currentPath: string, onComplete: () => void) {
	const [uploadState, setUploadState] = useState<UploadState>(INITIAL_STATE);

	const uploadFiles = useCallback(
		async (files: FileList | File[]) => {
			const fileArray = Array.from(files);
			if (fileArray.length === 0) return;

			setUploadState({
				uploading: true,
				progress: 0,
				fileName: fileArray.length === 1 ? fileArray[0].name : `${fileArray.length} files`,
				error: null,
			});

			let completed = 0;

			try {
				for (const file of fileArray) {
					setUploadState((prev) => ({
						...prev,
						fileName: fileArray.length === 1 ? file.name : `${file.name} (${completed + 1}/${fileArray.length})`,
					}));

					await uploadFile(file, currentPath);
					completed++;

					setUploadState((prev) => ({
						...prev,
						progress: Math.round((completed / fileArray.length) * 100),
					}));
				}

				setUploadState(INITIAL_STATE);
				onComplete();
			} catch (err) {
				setUploadState({
					uploading: false,
					progress: 0,
					fileName: null,
					error: err instanceof Error ? err.message : 'Upload failed',
				});
			}
		},
		[currentPath, onComplete]
	);

	const clearError = useCallback(() => {
		setUploadState(INITIAL_STATE);
	}, []);

	return { uploadState, uploadFiles, clearError };
}
