'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNats } from '@/lib/hooks/use-nats';
import { SUBJECTS } from '@/lib/subjects';
import type { FileEntry, FileListResponse, FileWriteRequest, FileWriteResponse } from './schema';

/**
 * Get the parent directory of a relative path.
 * e.g. '/subdir/file.txt' -> '/subdir', '/file.txt' -> '/'
 */
function parentDir(filePath: string): string {
	const lastSlash = filePath.lastIndexOf('/');
	if (lastSlash <= 0) return '/';
	return filePath.slice(0, lastSlash);
}

/**
 * Sort entries: directories first, then alphabetical by name (case-insensitive).
 */
function sortEntries(entries: FileEntry[]): FileEntry[] {
	return [...entries].sort((a, b) => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	});
}

export interface UseFilesReturn {
	currentPath: string;
	filesRoot: string;
	entries: FileEntry[];
	loading: boolean;
	error: string | null;
	navigateTo: (path: string) => void;
	refresh: () => void;
	goBack: () => void;
	goUp: () => void;
	canGoBack: boolean;
	writeOp: (op: FileWriteRequest) => Promise<FileWriteResponse>;
}

export function useFiles(): UseFilesReturn {
	const { request, subscribe, connected, orgId } = useNats();
	const [currentPath, setCurrentPath] = useState('/');
	const [filesRoot, setFilesRoot] = useState('');
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pathHistory, setPathHistory] = useState<string[]>([]);

	// Track whether we've fetched at least once for this path
	const lastFetchedPath = useRef<string | null>(null);

	const fetchEntries = useCallback(
		async (path: string) => {
			if (!connected) return;
			setLoading(true);
			setError(null);
			try {
				const response = (await request(SUBJECTS.fs.list(orgId), { path })) as FileListResponse & {
					error?: string;
				};
				if (response.error) {
					setError(response.error);
					setEntries([]);
				} else {
					setEntries(sortEntries(response.entries));
					setCurrentPath(response.path);
					if (response.root) setFilesRoot(response.root);
					lastFetchedPath.current = response.path;
				}
			} catch (err) {
				setError((err as Error).message || 'Failed to list directory');
				setEntries([]);
			} finally {
				setLoading(false);
			}
		},
		[connected, request]
	);

	// Fetch entries when path changes or connection becomes available
	useEffect(() => {
		if (connected && lastFetchedPath.current !== currentPath) {
			fetchEntries(currentPath);
		}
	}, [currentPath, connected, fetchEntries]);

	// Initial fetch when first connected
	useEffect(() => {
		if (connected && lastFetchedPath.current === null) {
			fetchEntries(currentPath);
		}
	}, [connected, currentPath, fetchEntries]);

	// --- Live watch: subscribe to fs.watch events and auto-refresh on changes ---
	// We use a ref for currentPath so the subscription callback always sees the latest value
	// without needing to re-subscribe every time the path changes.
	const currentPathRef = useRef(currentPath);
	currentPathRef.current = currentPath;

	// Debounce refresh calls from watch events to avoid rapid successive fetches
	const watchRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!connected) return;

		const watchSubject = 'os.fs.watch.>';
		const unsub = subscribe(watchSubject, (data: unknown) => {
			if (!data || typeof data !== 'object') return;
			const event = data as Record<string, unknown>;
			if (typeof event.type !== 'string' || typeof event.path !== 'string') return;

			// Check if this event's parent directory matches the currently viewed path
			const eventParent = parentDir(event.path as string);
			if (eventParent !== currentPathRef.current) return;

			// Debounce: coalesce rapid events (e.g. bulk operations) into a single refresh
			if (watchRefreshTimer.current) {
				clearTimeout(watchRefreshTimer.current);
			}
			watchRefreshTimer.current = setTimeout(() => {
				watchRefreshTimer.current = null;
				lastFetchedPath.current = null;
				fetchEntries(currentPathRef.current);
			}, 300);
		});

		return () => {
			unsub();
			if (watchRefreshTimer.current) {
				clearTimeout(watchRefreshTimer.current);
				watchRefreshTimer.current = null;
			}
		};
	}, [connected, subscribe, fetchEntries]);

	const navigateTo = useCallback(
		(path: string) => {
			setPathHistory((prev) => [...prev, currentPath]);
			setCurrentPath(path);
			lastFetchedPath.current = null; // Force re-fetch
		},
		[currentPath]
	);

	const refresh = useCallback(() => {
		lastFetchedPath.current = null; // Force re-fetch
		fetchEntries(currentPath);
	}, [currentPath, fetchEntries]);

	const goBack = useCallback(() => {
		if (pathHistory.length === 0) return;
		const previous = pathHistory[pathHistory.length - 1];
		setPathHistory((prev) => prev.slice(0, -1));
		setCurrentPath(previous);
		lastFetchedPath.current = null;
	}, [pathHistory]);

	const goUp = useCallback(() => {
		if (currentPath === '/') return;
		const segments = currentPath.split('/').filter(Boolean);
		segments.pop();
		const parentPath = segments.length === 0 ? '/' : `/${segments.join('/')}`;
		navigateTo(parentPath);
	}, [currentPath, navigateTo]);

	const writeOp = useCallback(
		async (op: FileWriteRequest): Promise<FileWriteResponse> => {
			if (!connected) {
				return { ok: false, error: 'Not connected' };
			}
			try {
				const response = (await request(SUBJECTS.fs.write(orgId), op)) as FileWriteResponse;
				if (response.ok) {
					// Refresh after successful write
					lastFetchedPath.current = null;
					fetchEntries(currentPath);
				}
				return response;
			} catch (err) {
				return { ok: false, error: (err as Error).message || 'Write operation failed' };
			}
		},
		[connected, request, currentPath, fetchEntries]
	);

	return {
		currentPath,
		filesRoot,
		entries,
		loading,
		error,
		navigateTo,
		refresh,
		goBack,
		goUp,
		canGoBack: pathHistory.length > 0,
		writeOp,
	};
}
