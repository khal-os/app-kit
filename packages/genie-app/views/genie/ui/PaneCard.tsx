'use client';

import { getNatsClient } from '@khal-os/sdk/app';
import { useCallback, useState } from 'react';
import { SUBJECTS } from '../../../lib/subjects';
import { XTermPane } from './XTermPane';

interface AgentInfo {
	name: string;
	color: string;
	state: string;
	role: string;
}

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
	agent: AgentInfo | null;
}

interface PaneCardProps {
	pane: PaneData;
	isMaximized: boolean;
	onMaximize: () => void;
	onRestore: () => void;
}

const COLOR_MAP: Record<string, string> = {
	red: '#ef4444',
	blue: '#3b82f6',
	green: '#22c55e',
	yellow: '#eab308',
	purple: '#a855f7',
	orange: '#f97316',
	pink: '#ec4899',
	cyan: '#06b6d4',
};

const STATE_COLORS: Record<string, string> = {
	working: '#22c55e',
	running: '#22c55e',
	active: '#22c55e',
	spawning: '#eab308',
	starting: '#eab308',
	idle: '#6b7280',
	offline: '#6b7280',
	unknown: '#6b7280',
};

function resolveColor(color: string | undefined): string {
	if (!color) return '#6b7280';
	return COLOR_MAP[color] || color;
}

function stateColor(state: string | undefined): string {
	if (!state) return '#6b7280';
	return STATE_COLORS[state] || '#6b7280';
}

function displayName(pane: PaneData): string {
	return pane.agent?.name || pane.title || pane.command;
}

// --- Kill confirmation mini-dialog (inline above the pane) ---

function PaneKillConfirm({
	agentName,
	onConfirm,
	onCancel,
	loading,
}: {
	agentName: string;
	onConfirm: () => void;
	onCancel: () => void;
	loading: boolean;
}) {
	return (
		<div className="absolute inset-x-0 top-7 z-10 flex items-center justify-between border-b border-white/10 bg-red-950/80 px-2 py-1.5 backdrop-blur-sm">
			<span className="text-[10px] text-red-300">
				Kill <span className="font-semibold">{agentName}</span>?
			</span>
			<div className="flex gap-1">
				<button
					type="button"
					onClick={onCancel}
					className="rounded px-1.5 py-0.5 text-[10px] text-[var(--os-text-secondary)] hover:bg-white/10"
				>
					No
				</button>
				<button
					type="button"
					onClick={onConfirm}
					disabled={loading}
					className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-500 disabled:opacity-50"
				>
					{loading ? '...' : 'Yes'}
				</button>
			</div>
		</div>
	);
}

// --- Agent action helpers ---

async function natsAgentAction(subject: string, name: string): Promise<void> {
	const client = getNatsClient();
	const response = (await client.request(subject, { name }, 10000)) as { ok?: boolean; error?: string };
	if (response.error) throw new Error(response.error);
}

export function PaneCard({ pane, isMaximized, onMaximize, onRestore }: PaneCardProps) {
	const color = resolveColor(pane.agent?.color);
	const name = displayName(pane);
	const role = pane.agent?.role;
	const state = pane.agent?.state;
	const hasAgent = pane.agent !== null;

	const [showKillConfirm, setShowKillConfirm] = useState(false);
	const [actionLoading, setActionLoading] = useState(false);

	const handleHeaderDoubleClick = useCallback(() => {
		if (isMaximized) {
			onRestore();
		} else {
			onMaximize();
		}
	}, [isMaximized, onMaximize, onRestore]);

	const handleMaximizeClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (isMaximized) {
				onRestore();
			} else {
				onMaximize();
			}
		},
		[isMaximized, onMaximize, onRestore]
	);

	const handleStop = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation();
			if (!pane.agent) return;
			setActionLoading(true);
			try {
				await natsAgentAction(SUBJECTS.agent.stop(), pane.agent.name);
			} catch {
				// best-effort — agent may already be stopped
			} finally {
				setActionLoading(false);
			}
		},
		[pane.agent]
	);

	const handleKillClick = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setShowKillConfirm(true);
	}, []);

	const handleKillConfirm = useCallback(async () => {
		if (!pane.agent) return;
		setActionLoading(true);
		try {
			await natsAgentAction(SUBJECTS.agent.kill(), pane.agent.name);
		} catch {
			// best-effort
		} finally {
			setActionLoading(false);
			setShowKillConfirm(false);
		}
	}, [pane.agent]);

	const wrapperClass = isMaximized
		? 'fixed inset-0 z-50 flex flex-col bg-black/95'
		: 'relative flex h-full flex-col overflow-hidden rounded border border-white/10 bg-black/40 shadow-lg';

	return (
		<div className={wrapperClass}>
			{/* Header bar — compact ~28px */}
			<div
				className="pane-card-header group flex shrink-0 cursor-grab items-center gap-1.5 border-b border-white/10 px-2 active:cursor-grabbing"
				style={{ height: '28px' }}
				onDoubleClick={handleHeaderDoubleClick}
			>
				{/* Color dot */}
				<div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />

				{/* Agent name */}
				<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--os-text-primary)]">{name}</span>

				{/* Role badge */}
				{role && (
					<span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] leading-none text-[var(--os-text-secondary)]">
						{role}
					</span>
				)}

				{/* Dead badge */}
				{pane.dead && <span className="shrink-0 rounded bg-red-500/20 px-1 py-0.5 text-[9px] text-red-400">dead</span>}

				{/* State indicator dot */}
				{state && !pane.dead && (
					<div
						className="h-1.5 w-1.5 shrink-0 rounded-full"
						style={{ backgroundColor: stateColor(state) }}
						title={state}
					/>
				)}

				{/* Agent action buttons — only for agent panes, visible on hover */}
				{hasAgent && !pane.dead && (
					<div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
						{/* Stop (pause icon) */}
						<button
							type="button"
							onClick={handleStop}
							disabled={actionLoading}
							className="shrink-0 rounded p-0.5 text-[var(--os-text-secondary)] hover:bg-yellow-500/20 hover:text-yellow-400 disabled:opacity-50"
							title="Stop agent"
						>
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
								<title>Stop</title>
								<rect x="2" y="2" width="3" height="8" rx="0.5" />
								<rect x="7" y="2" width="3" height="8" rx="0.5" />
							</svg>
						</button>

						{/* Kill (x icon) */}
						<button
							type="button"
							onClick={handleKillClick}
							disabled={actionLoading}
							className="shrink-0 rounded p-0.5 text-[var(--os-text-secondary)] hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
							title="Kill agent"
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 12 12"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.2"
								strokeLinecap="round"
							>
								<title>Kill</title>
								<path d="M3 3l6 6M9 3l-6 6" />
							</svg>
						</button>
					</div>
				)}

				{/* Maximize/Restore button */}
				<button
					type="button"
					onClick={handleMaximizeClick}
					className="shrink-0 rounded p-0.5 text-[var(--os-text-secondary)] hover:bg-white/10 hover:text-[var(--os-text-primary)]"
					title={isMaximized ? 'Restore' : 'Maximize'}
				>
					{isMaximized ? (
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<title>Restore</title>
							<rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" />
							<path
								d="M4 2.5V1.5C4 0.948 4.448 0.5 5 0.5H10.5C11.052 0.5 11.5 0.948 11.5 1.5V7C11.5 7.552 11.052 8 10.5 8H9.5"
								stroke="currentColor"
								strokeWidth="1"
							/>
						</svg>
					) : (
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<title>Maximize</title>
							<rect x="0.5" y="0.5" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1" />
						</svg>
					)}
				</button>
			</div>

			{/* Kill confirmation bar */}
			{showKillConfirm && pane.agent && (
				<PaneKillConfirm
					agentName={pane.agent.name}
					onConfirm={handleKillConfirm}
					onCancel={() => setShowKillConfirm(false)}
					loading={actionLoading}
				/>
			)}

			{/* Terminal body */}
			<div className="min-h-0 flex-1 overflow-hidden">
				<XTermPane tmuxPaneId={pane.id} />
			</div>
		</div>
	);
}

export type { AgentInfo, PaneData as PaneCardData };
