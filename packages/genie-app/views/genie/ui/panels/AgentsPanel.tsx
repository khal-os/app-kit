'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SUBJECTS } from '../../../../lib/subjects';
import { useNatsAction } from '../hooks/useNatsAction';
import { useNatsLive } from '../hooks/useNatsLive';

// --- Types matching service responses ---

interface AgentInfo {
	name: string;
	color: string;
	state: string;
	role: string;
}

interface PaneData {
	id: string;
	agent: AgentInfo | null;
}

interface WindowData {
	panes: PaneData[];
}

interface SessionData {
	name: string;
	windows: WindowData[];
}

interface AgentsResponse {
	sessions: SessionData[];
	error?: string;
}

interface FlatAgent {
	name: string;
	role: string;
	team: string;
	state: string;
	color: string;
}

// --- State dot colors ---

const STATE_DOT: Record<string, { color: string; label: string }> = {
	working: { color: '#22c55e', label: 'Working' },
	running: { color: '#22c55e', label: 'Running' },
	active: { color: '#22c55e', label: 'Active' },
	spawning: { color: '#eab308', label: 'Spawning' },
	starting: { color: '#eab308', label: 'Starting' },
	idle: { color: '#6b7280', label: 'Idle' },
	offline: { color: '#6b7280', label: 'Offline' },
	unknown: { color: '#6b7280', label: 'Unknown' },
};

function getStateDot(state: string) {
	return STATE_DOT[state] ?? STATE_DOT.unknown;
}

// --- Flatten sessions → agents ---

function flattenAgents(sessions: SessionData[]): FlatAgent[] {
	const agents: FlatAgent[] = [];
	for (const session of sessions) {
		for (const window of session.windows) {
			for (const pane of window.panes) {
				if (pane.agent) {
					agents.push({
						name: pane.agent.name,
						role: pane.agent.role,
						team: session.name,
						state: pane.agent.state,
						color: pane.agent.color,
					});
				}
			}
		}
	}
	return agents;
}

// --- Answer dialog ---

function AnswerDialog({ agentName, onClose }: { agentName: string; onClose: () => void }) {
	const [input, setInput] = useState('');
	const { execute, loading, error } = useNatsAction(SUBJECTS.agent.answer());
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleSubmit = useCallback(async () => {
		if (!input.trim()) return;
		try {
			await execute({ name: agentName, choice: input.trim() });
			onClose();
		} catch {
			// error is surfaced via the hook
		}
	}, [input, agentName, execute, onClose]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
			if (e.key === 'Escape') {
				onClose();
			}
		},
		[handleSubmit, onClose]
	);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
			<div
				className="w-80 rounded-lg border border-white/10 bg-[#1a1a2e] p-4 shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<h3 className="text-sm font-semibold text-[var(--os-text-primary)] mb-1">Answer: {agentName}</h3>
				<p className="text-xs text-[var(--os-text-secondary)] mb-3">
					Enter a number for choices, or &quot;text:your message&quot; for free-form input.
				</p>

				<input
					ref={inputRef}
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="e.g. 1 or text:continue"
					className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-[var(--os-text-primary)] placeholder:text-[var(--os-text-secondary)] focus:border-blue-500/50 focus:outline-none"
				/>

				{error && <p className="mt-1 text-xs text-red-400">{error}</p>}

				<div className="mt-3 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded px-2.5 py-1 text-xs text-[var(--os-text-secondary)] hover:bg-white/10"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={loading || !input.trim()}
						className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
					>
						{loading ? 'Sending...' : 'Send'}
					</button>
				</div>
			</div>
		</div>
	);
}

// --- Kill confirmation dialog ---

function KillConfirmDialog({
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
			<div
				className="w-72 rounded-lg border border-white/10 bg-[#1a1a2e] p-4 shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<h3 className="text-sm font-semibold text-[var(--os-text-primary)] mb-2">Kill Agent</h3>
				<p className="text-xs text-[var(--os-text-secondary)] mb-4">
					Are you sure you want to kill <span className="text-red-400 font-semibold">{agentName}</span>? This action
					cannot be undone.
				</p>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className="rounded px-2.5 py-1 text-xs text-[var(--os-text-secondary)] hover:bg-white/10"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						disabled={loading}
						className="rounded bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-50"
					>
						{loading ? 'Killing...' : 'Kill'}
					</button>
				</div>
			</div>
		</div>
	);
}

// --- Agent row ---

function AgentRow({
	agent,
	onKill,
	onStop,
	onAnswer,
}: {
	agent: FlatAgent;
	onKill: () => void;
	onStop: () => void;
	onAnswer: () => void;
}) {
	const dot = getStateDot(agent.state);

	return (
		<div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
			{/* State dot */}
			<div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot.color }} title={dot.label} />

			{/* Name + meta */}
			<div className="min-w-0 flex-1">
				<div className="truncate text-xs font-medium text-[var(--os-text-primary)]">{agent.name}</div>
				<div className="flex items-center gap-1.5 text-[10px] text-[var(--os-text-secondary)]">
					{agent.role && <span className="rounded bg-white/10 px-1 py-px">{agent.role}</span>}
					<span className="truncate">{agent.team}</span>
				</div>
			</div>

			{/* Action buttons — visible on hover */}
			<div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				{/* Answer */}
				<button
					type="button"
					onClick={onAnswer}
					className="rounded p-1 text-[var(--os-text-secondary)] hover:bg-blue-500/20 hover:text-blue-400"
					title="Answer"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<title>Answer</title>
						<path d="M1 3h10a.5.5 0 01.5.5v5a.5.5 0 01-.5.5H4l-2 1.5V3.5A.5.5 0 011 3z" />
					</svg>
				</button>

				{/* Stop */}
				<button
					type="button"
					onClick={onStop}
					className="rounded p-1 text-[var(--os-text-secondary)] hover:bg-yellow-500/20 hover:text-yellow-400"
					title="Stop"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
						<title>Stop</title>
						<rect x="2" y="2" width="3" height="8" rx="0.5" />
						<rect x="7" y="2" width="3" height="8" rx="0.5" />
					</svg>
				</button>

				{/* Kill */}
				<button
					type="button"
					onClick={onKill}
					className="rounded p-1 text-[var(--os-text-secondary)] hover:bg-red-500/20 hover:text-red-400"
					title="Kill"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
					>
						<title>Kill</title>
						<path d="M2 2l8 8M10 2l-8 8" />
					</svg>
				</button>
			</div>
		</div>
	);
}

// --- Main panel ---

export function AgentsPanel() {
	const { data, loading, error, refetch } = useNatsLive<AgentsResponse>({
		requestSubject: SUBJECTS.agents.list(),
		changeSubject: SUBJECTS.agents.changed(),
	});

	const killAction = useNatsAction(SUBJECTS.agent.kill());
	const stopAction = useNatsAction(SUBJECTS.agent.stop());

	const [answerTarget, setAnswerTarget] = useState<string | null>(null);
	const [killTarget, setKillTarget] = useState<string | null>(null);

	const agents = data?.sessions ? flattenAgents(data.sessions) : [];

	const handleKillConfirm = useCallback(async () => {
		if (!killTarget) return;
		try {
			await killAction.execute({ name: killTarget });
			setKillTarget(null);
			refetch();
		} catch {
			// error surfaced via hook
		}
	}, [killTarget, killAction, refetch]);

	const handleStop = useCallback(
		async (name: string) => {
			try {
				await stopAction.execute({ name });
				refetch();
			} catch {
				// error surfaced via hook
			}
		},
		[stopAction, refetch]
	);

	if (loading && !data) {
		return (
			<div className="flex h-32 items-center justify-center">
				<p className="text-xs text-[var(--os-text-secondary)]">Loading agents...</p>
			</div>
		);
	}

	if (error && !data) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-4">
				<p className="text-xs text-red-400">{error}</p>
				<button type="button" onClick={refetch} className="rounded bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20">
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1 p-2">
			{/* Header with count */}
			<div className="flex items-center justify-between px-1 mb-1">
				<span className="text-[10px] text-[var(--os-text-secondary)]">
					{agents.length} agent{agents.length !== 1 ? 's' : ''}
				</span>
				{(killAction.error || stopAction.error) && (
					<span className="text-[10px] text-red-400 truncate max-w-[150px]">
						{killAction.error || stopAction.error}
					</span>
				)}
			</div>

			{agents.length === 0 ? (
				<div className="flex h-20 items-center justify-center">
					<p className="text-xs text-[var(--os-text-secondary)]">No agents running</p>
				</div>
			) : (
				agents.map((agent) => (
					<AgentRow
						key={agent.name}
						agent={agent}
						onKill={() => setKillTarget(agent.name)}
						onStop={() => handleStop(agent.name)}
						onAnswer={() => setAnswerTarget(agent.name)}
					/>
				))
			)}

			{/* Answer dialog */}
			{answerTarget && <AnswerDialog agentName={answerTarget} onClose={() => setAnswerTarget(null)} />}

			{/* Kill confirmation */}
			{killTarget && (
				<KillConfirmDialog
					agentName={killTarget}
					onConfirm={handleKillConfirm}
					onCancel={() => setKillTarget(null)}
					loading={killAction.loading}
				/>
			)}
		</div>
	);
}
