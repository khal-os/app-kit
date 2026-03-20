'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import RGL, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { getNatsClient } from '@/lib/nats-client';
import { SUBJECTS } from '../../../lib/subjects';
import { PaneCard } from './PaneCard';
import { Sidebar } from './Sidebar';
import { type SessionTab, TabBar } from './TabBar';

// --- Types ---

interface PaneData {
	id: string;
	windowId: string;
	active: boolean;
	pid: number;
	command: string;
	title: string;
	left: number;
	top: number;
	width: number;
	height: number;
	dead: boolean;
	agent: { name: string; color: string; state: string; role: string } | null;
}

interface WindowData {
	id: string;
	name: string;
	panes: PaneData[];
	active: boolean;
	sessionId: string;
	width: number;
	height: number;
}

interface SessionData {
	id: string;
	name: string;
	windows: WindowData[];
	attached: number;
}

interface AgentsResponse {
	sessions: SessionData[];
	error?: string;
}

// --- Constants ---

const SESSION_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#eab308', '#ef4444'];
const GRID_COLS = 12;
const ROW_HEIGHT = 75;
const LAYOUT_KEY_PREFIX = 'genie-canvas-layout-';

// --- Grid Layout ---

const GridLayout = WidthProvider(RGL);

function storageKey(sessionName: string): string {
	return `${LAYOUT_KEY_PREFIX}${sessionName}`;
}

function computeAutoLayout(panes: PaneData[], offset = 0): Layout[] {
	const total = panes.length + offset;
	const gridCols = total <= 4 ? 2 : total <= 9 ? 3 : 4;
	const w = GRID_COLS / gridCols;
	const h = 4; // 4 * 75px = 300px

	return panes.map((pane, i) => {
		const idx = i + offset;
		return {
			i: pane.id,
			x: (idx % gridCols) * w,
			y: Math.floor(idx / gridCols) * h,
			w,
			h,
			minH: 3,
			minW: 2,
		};
	});
}

function loadSavedLayout(sessionName: string): Layout[] | null {
	try {
		const stored = localStorage.getItem(storageKey(sessionName));
		if (!stored) return null;
		return JSON.parse(stored);
	} catch {
		return null;
	}
}

function mergeLayout(saved: Layout[] | null, panes: PaneData[]): Layout[] {
	if (!saved || saved.length === 0) return computeAutoLayout(panes);

	const paneIds = new Set(panes.map((p) => p.id));

	// Keep saved positions for panes that still exist
	const kept = saved.filter((item) => paneIds.has(item.i));
	const keptIds = new Set(kept.map((item) => item.i));

	// Auto-place new panes at the end of the grid
	const newPanes = panes.filter((p) => !keptIds.has(p.id));
	if (newPanes.length === 0) return kept;

	const autoPlaced = computeAutoLayout(newPanes, kept.length);
	return [...kept, ...autoPlaced];
}

function paneIdKey(panes: PaneData[]): string {
	return panes
		.map((p) => p.id)
		.sort()
		.join(',');
}

// --- Canvas: renders all panes as a grid ---

function Canvas({
	panes,
	sessionName,
	onResetRef,
}: {
	panes: PaneData[];
	sessionName: string;
	onResetRef: React.RefObject<(() => void) | null>;
}) {
	const [maximizedPaneId, setMaximizedPaneId] = useState<string | null>(null);
	const [layout, setLayout] = useState<Layout[]>(() => mergeLayout(loadSavedLayout(sessionName), panes));
	const prevPaneKeyRef = useRef(paneIdKey(panes));
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Recompute layout only when pane set changes (add/remove), not on every poll
	useEffect(() => {
		const key = paneIdKey(panes);
		if (key === prevPaneKeyRef.current) return;
		prevPaneKeyRef.current = key;
		setLayout((prev) => mergeLayout(prev.length > 0 ? prev : loadSavedLayout(sessionName), panes));
	}, [panes, sessionName]);

	// Expose reset function to parent
	useEffect(() => {
		onResetRef.current = () => {
			localStorage.removeItem(storageKey(sessionName));
			setLayout(computeAutoLayout(panes));
		};
		return () => {
			onResetRef.current = null;
		};
	}, [sessionName, panes, onResetRef]);

	// Persist layout to localStorage on change (debounced)
	const handleLayoutChange = useCallback(
		(newLayout: Layout[]) => {
			setLayout(newLayout);
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => {
				localStorage.setItem(storageKey(sessionName), JSON.stringify(newLayout));
			}, 500);
		},
		[sessionName]
	);

	// Cleanup save timer
	useEffect(() => {
		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, []);

	if (panes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-sm text-[var(--os-text-secondary)]">No panes in this session</p>
			</div>
		);
	}

	const hasMaximized = maximizedPaneId !== null;

	return (
		<div className="genie-canvas relative h-full overflow-auto">
			<GridLayout
				layout={layout}
				cols={GRID_COLS}
				rowHeight={ROW_HEIGHT}
				draggableHandle=".pane-card-header"
				onLayoutChange={handleLayoutChange}
				isDraggable={!hasMaximized}
				isResizable={!hasMaximized}
				compactType="vertical"
				margin={[4, 4]}
				containerPadding={[4, 4]}
			>
				{panes.map((pane) => (
					<div key={pane.id} className="h-full">
						<PaneCard
							pane={pane}
							isMaximized={maximizedPaneId === pane.id}
							onMaximize={() => setMaximizedPaneId(pane.id)}
							onRestore={() => setMaximizedPaneId(null)}
						/>
					</div>
				))}
			</GridLayout>
		</div>
	);
}

// --- Main Component ---

export function WorkspaceCanvas(_props: { windowId: string; meta?: Record<string, unknown> }) {
	const [sessions, setSessions] = useState<SessionData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const resetLayoutRef = useRef<(() => void) | null>(null);

	const fetchData = useCallback(async () => {
		try {
			const client = getNatsClient();
			const response = await client.request(SUBJECTS.agents.list(), {}, 5000);
			const data = response as AgentsResponse;
			if (data.error) {
				setError(data.error);
				return;
			}
			setSessions(data.sessions || []);
			setError(null);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	// Polling
	useEffect(() => {
		fetchData();
		intervalRef.current = setInterval(fetchData, 5000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [fetchData]);

	// Auto-select first session if none selected or current selection is gone
	useEffect(() => {
		if (sessions.length === 0) return;
		const currentExists = sessions.some((s) => s.id === activeSessionId);
		if (!activeSessionId || !currentExists) {
			const sorted = [...sessions].sort((a, b) => a.name.localeCompare(b.name));
			setActiveSessionId(sorted[0].id);
		}
	}, [sessions, activeSessionId]);

	// Build sorted tabs
	const tabs: SessionTab[] = useMemo(() => {
		return [...sessions]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((session, i) => ({
				id: session.id,
				name: session.name,
				paneCount: session.windows.reduce((sum, w) => sum + w.panes.length, 0),
				color: SESSION_COLORS[i % SESSION_COLORS.length],
			}));
	}, [sessions]);

	// Collect all panes for the active session
	const activePanes: PaneData[] = useMemo(() => {
		const session = sessions.find((s) => s.id === activeSessionId);
		if (!session) return [];
		return session.windows.flatMap((w) => w.panes);
	}, [sessions, activeSessionId]);

	// Get session name for layout persistence key
	const activeSessionName = useMemo(() => {
		const session = sessions.find((s) => s.id === activeSessionId);
		return session?.name ?? '';
	}, [sessions, activeSessionId]);

	const handleResetLayout = useCallback(() => {
		resetLayoutRef.current?.();
	}, []);

	// Main content area (loading / error / empty / canvas)
	let content: React.ReactNode;
	if (loading) {
		content = (
			<div className="flex h-full items-center justify-center">
				<p className="text-sm text-[var(--os-text-secondary)]">Connecting to tmux...</p>
			</div>
		);
	} else if (error) {
		content = (
			<div className="flex h-full flex-col items-center justify-center gap-2">
				<p className="text-sm text-red-400">Error: {error}</p>
				<button type="button" onClick={fetchData} className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
					Retry
				</button>
			</div>
		);
	} else if (sessions.length === 0) {
		content = (
			<div className="flex h-full items-center justify-center">
				<p className="text-sm text-[var(--os-text-secondary)]">No tmux sessions found</p>
			</div>
		);
	} else {
		content = (
			<div className="flex h-full flex-col">
				<TabBar
					tabs={tabs}
					activeSessionId={activeSessionId}
					onSelectSession={setActiveSessionId}
					onResetLayout={handleResetLayout}
				/>
				<div className="min-h-0 flex-1">
					<Canvas
						key={activeSessionId}
						panes={activePanes}
						sessionName={activeSessionName}
						onResetRef={resetLayoutRef}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full">
			<Sidebar />
			<div className="min-w-0 flex-1">{content}</div>
		</div>
	);
}

export type { AgentsResponse, PaneData, SessionData, WindowData };
