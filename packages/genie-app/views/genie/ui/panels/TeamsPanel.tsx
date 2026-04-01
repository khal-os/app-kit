'use client';

import { useCallback, useState } from 'react';
import { SUBJECTS } from '../../../../lib/subjects';
import { useNatsAction } from '../hooks/useNatsAction';
import { useNatsLive } from '../hooks/useNatsLive';
import { useNatsRequest } from '../hooks/useNatsRequest';

// --- Types matching service responses ---

interface TeamListItem {
	name: string;
	slug?: string;
	status?: string;
	members?: number;
	repo?: string;
	branch?: string;
	wish?: string;
}

interface TeamsListResponse {
	teams: TeamListItem[];
	error?: string;
}

interface TeamMember {
	name: string;
	role?: string;
	status?: string;
}

interface TeamConfig {
	name: string;
	repo?: string;
	branch?: string;
	wish?: string;
	status?: string;
	members?: TeamMember[];
	agents?: TeamMember[];
	[key: string]: unknown;
}

interface TeamGetResponse {
	team: TeamConfig;
	error?: string;
}

interface ActionResponse {
	ok: boolean;
	error?: string;
	output?: string;
}

// --- Status badge colors ---

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
	done: { bg: 'bg-green-500/20', text: 'text-green-400' },
	completed: { bg: 'bg-green-500/20', text: 'text-green-400' },
	in_progress: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
	active: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
	working: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
	blocked: { bg: 'bg-red-500/20', text: 'text-red-400' },
	error: { bg: 'bg-red-500/20', text: 'text-red-400' },
	idle: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

function getStatusStyle(status?: string) {
	if (!status) return { bg: 'bg-gray-500/20', text: 'text-gray-400' };
	return STATUS_COLORS[status.toLowerCase()] ?? { bg: 'bg-gray-500/20', text: 'text-gray-400' };
}

// --- Confirmation dialog ---

function ConfirmDialog({
	message,
	onConfirm,
	onCancel,
}: {
	message: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<div className="w-72 rounded-lg border border-white/10 bg-[#1a1a2e] p-4 shadow-xl">
				<p className="mb-4 text-xs text-[var(--os-text-primary)]">{message}</p>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className="rounded px-3 py-1 text-xs text-[var(--os-text-secondary)] hover:bg-white/10"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="rounded bg-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/30"
					>
						Confirm
					</button>
				</div>
			</div>
		</div>
	);
}

// --- Create team dialog ---

function CreateTeamDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
	const [name, setName] = useState('');
	const [repo, setRepo] = useState('');
	const [branch, setBranch] = useState('');
	const [wish, setWish] = useState('');
	const [resultMsg, setResultMsg] = useState<string | null>(null);

	const { execute, loading, error } = useNatsAction<ActionResponse>(SUBJECTS.teams.create());

	const handleSubmit = useCallback(async () => {
		if (!name.trim() || !repo.trim()) return;
		try {
			const payload: Record<string, string> = { name: name.trim(), repo: repo.trim() };
			if (branch.trim()) payload.branch = branch.trim();
			if (wish.trim()) payload.wish = wish.trim();
			const res = await execute(payload);
			if (res.ok) {
				setResultMsg('Team created successfully');
				setTimeout(() => {
					onCreated();
					onClose();
				}, 800);
			} else {
				setResultMsg(res.error ?? 'Create failed');
			}
		} catch {
			// error state handled by hook
		}
	}, [name, repo, branch, wish, execute, onCreated, onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
			<div className="w-80 rounded-lg border border-white/10 bg-[#1a1a2e] p-4 shadow-xl">
				<h3 className="mb-3 text-xs font-semibold text-[var(--os-text-primary)]">Create Team</h3>

				<div className="flex flex-col gap-2">
					<input
						type="text"
						placeholder="Team name *"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-[var(--os-text-primary)] placeholder:text-[var(--os-text-muted)] focus:border-white/20 focus:outline-none"
					/>
					<input
						type="text"
						placeholder="Repo path *"
						value={repo}
						onChange={(e) => setRepo(e.target.value)}
						className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-[var(--os-text-primary)] placeholder:text-[var(--os-text-muted)] focus:border-white/20 focus:outline-none"
					/>
					<input
						type="text"
						placeholder="Branch (optional)"
						value={branch}
						onChange={(e) => setBranch(e.target.value)}
						className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-[var(--os-text-primary)] placeholder:text-[var(--os-text-muted)] focus:border-white/20 focus:outline-none"
					/>
					<input
						type="text"
						placeholder="Wish slug (optional)"
						value={wish}
						onChange={(e) => setWish(e.target.value)}
						className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-[var(--os-text-primary)] placeholder:text-[var(--os-text-muted)] focus:border-white/20 focus:outline-none"
					/>
				</div>

				{error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}
				{resultMsg && <p className="mt-2 text-[10px] text-green-400">{resultMsg}</p>}

				<div className="mt-3 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						disabled={loading}
						className="rounded px-3 py-1 text-xs text-[var(--os-text-secondary)] hover:bg-white/10"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={loading || !name.trim() || !repo.trim()}
						className="rounded bg-white/10 px-3 py-1 text-xs text-[var(--os-text-primary)] hover:bg-white/15 disabled:opacity-40"
					>
						{loading ? 'Creating...' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	);
}

// --- Expanded team row (member list) ---

function TeamMembers({ teamName, onRefreshList }: { teamName: string; onRefreshList: () => void }) {
	const { data, loading, error } = useNatsRequest<TeamGetResponse>(
		SUBJECTS.teams.get(),
		{ name: teamName },
		0 // no polling, one-shot fetch
	);

	const { execute: hireAgent, loading: hiringLoading } = useNatsAction<ActionResponse>(SUBJECTS.teams.hire());
	const { execute: fireAgent, loading: firingLoading } = useNatsAction<ActionResponse>(SUBJECTS.teams.fire());

	const [hireInput, setHireInput] = useState('');
	const [actionMsg, setActionMsg] = useState<string | null>(null);
	const [confirmFire, setConfirmFire] = useState<string | null>(null);

	const members = data?.team?.members ?? data?.team?.agents ?? [];

	const handleHire = useCallback(async () => {
		if (!hireInput.trim()) return;
		try {
			const res = await hireAgent({ agent: hireInput.trim(), team: teamName });
			if (res.ok) {
				setHireInput('');
				setActionMsg('Agent hired');
				onRefreshList();
				setTimeout(() => setActionMsg(null), 2000);
			} else {
				setActionMsg(res.error ?? 'Hire failed');
			}
		} catch {
			// error state from hook
		}
	}, [hireInput, teamName, hireAgent, onRefreshList]);

	const handleFire = useCallback(
		async (agentName: string) => {
			try {
				const res = await fireAgent({ agent: agentName, team: teamName });
				if (res.ok) {
					setConfirmFire(null);
					setActionMsg('Agent fired');
					onRefreshList();
					setTimeout(() => setActionMsg(null), 2000);
				} else {
					setActionMsg(res.error ?? 'Fire failed');
				}
			} catch {
				// error state from hook
			}
		},
		[teamName, fireAgent, onRefreshList]
	);

	if (loading) {
		return <p className="px-3 py-2 text-[10px] text-[var(--os-text-muted)]">Loading members...</p>;
	}

	if (error) {
		return <p className="px-3 py-2 text-[10px] text-red-400">{error}</p>;
	}

	return (
		<div className="border-t border-white/5 bg-white/[0.02] px-3 py-2">
			{/* Member list */}
			{members.length === 0 ? (
				<p className="text-[10px] text-[var(--os-text-muted)]">No members</p>
			) : (
				<div className="flex flex-col gap-1">
					{members.map((member) => {
						const m = typeof member === 'string' ? { name: member } : member;
						return (
							<div key={m.name} className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-1.5 min-w-0">
									<span className="truncate text-[11px] text-[var(--os-text-primary)]">{m.name}</span>
									{m.role && (
										<span className="shrink-0 rounded bg-white/10 px-1 py-0.5 text-[9px] text-[var(--os-text-secondary)]">
											{m.role}
										</span>
									)}
								</div>
								<button
									type="button"
									onClick={() => setConfirmFire(m.name)}
									disabled={firingLoading}
									className="shrink-0 rounded px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-red-500/10"
								>
									Fire
								</button>
							</div>
						);
					})}
				</div>
			)}

			{/* Hire input */}
			<div className="mt-2 flex items-center gap-1">
				<input
					type="text"
					placeholder="Agent name"
					value={hireInput}
					onChange={(e) => setHireInput(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && handleHire()}
					className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-[var(--os-text-primary)] placeholder:text-[var(--os-text-muted)] focus:border-white/20 focus:outline-none"
				/>
				<button
					type="button"
					onClick={handleHire}
					disabled={hiringLoading || !hireInput.trim()}
					className="shrink-0 rounded bg-white/10 px-2 py-1 text-[10px] text-[var(--os-text-primary)] hover:bg-white/15 disabled:opacity-40"
				>
					Hire
				</button>
			</div>

			{actionMsg && <p className="mt-1 text-[10px] text-green-400">{actionMsg}</p>}

			{confirmFire && (
				<ConfirmDialog
					message={`Fire agent "${confirmFire}" from team "${teamName}"?`}
					onConfirm={() => handleFire(confirmFire)}
					onCancel={() => setConfirmFire(null)}
				/>
			)}
		</div>
	);
}

// --- Team row ---

function TeamRow({
	team,
	isExpanded,
	onToggle,
	onRefreshList,
}: {
	team: TeamListItem;
	isExpanded: boolean;
	onToggle: () => void;
	onRefreshList: () => void;
}) {
	const { execute: disbandTeam, loading: disbandLoading } = useNatsAction<ActionResponse>(SUBJECTS.teams.disband());
	const { execute: markDone, loading: doneLoading } = useNatsAction<ActionResponse>(SUBJECTS.teams.done());
	const { execute: markBlocked, loading: blockedLoading } = useNatsAction<ActionResponse>(SUBJECTS.teams.blocked());

	const [confirmAction, setConfirmAction] = useState<{ type: string; fn: () => void } | null>(null);

	const statusStyle = getStatusStyle(team.status);

	const handleDisband = useCallback(async () => {
		try {
			await disbandTeam({ name: team.name });
			onRefreshList();
		} catch {
			// error from hook
		}
	}, [team.name, disbandTeam, onRefreshList]);

	const handleDone = useCallback(async () => {
		try {
			await markDone({ name: team.name });
			onRefreshList();
		} catch {
			// error from hook
		}
	}, [team.name, markDone, onRefreshList]);

	const handleBlocked = useCallback(async () => {
		try {
			await markBlocked({ name: team.name });
			onRefreshList();
		} catch {
			// error from hook
		}
	}, [team.name, markBlocked, onRefreshList]);

	const actionLoading = disbandLoading || doneLoading || blockedLoading;

	return (
		<div className="border-b border-white/5">
			{/* Main row */}
			<div
				className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-white/5"
				onClick={onToggle}
				onKeyDown={(e) => e.key === 'Enter' && onToggle()}
				role="button"
				tabIndex={0}
			>
				{/* Expand chevron */}
				<span
					className="shrink-0 text-[10px] text-[var(--os-text-muted)] transition-transform"
					style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
				>
					&#9654;
				</span>

				{/* Team name */}
				<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--os-text-primary)]">
					{team.name}
				</span>

				{/* Status badge */}
				{team.status && (
					<span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] ${statusStyle.bg} ${statusStyle.text}`}>
						{team.status}
					</span>
				)}

				{/* Member count */}
				{team.members != null && (
					<span className="shrink-0 text-[10px] text-[var(--os-text-muted)]">{team.members}m</span>
				)}
			</div>

			{/* Info row (repo) */}
			{isExpanded && team.repo && (
				<div className="px-3 pb-1 pl-7">
					<span className="text-[10px] text-[var(--os-text-muted)]">{team.repo}</span>
				</div>
			)}

			{/* Action buttons */}
			{isExpanded && (
				<div className="flex items-center gap-1 px-3 pb-2 pl-7">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handleDone();
						}}
						disabled={actionLoading}
						className="rounded bg-green-500/10 px-2 py-0.5 text-[9px] text-green-400 hover:bg-green-500/20 disabled:opacity-40"
					>
						Done
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handleBlocked();
						}}
						disabled={actionLoading}
						className="rounded bg-yellow-500/10 px-2 py-0.5 text-[9px] text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-40"
					>
						Blocked
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setConfirmAction({ type: 'disband', fn: handleDisband });
						}}
						disabled={actionLoading}
						className="rounded bg-red-500/10 px-2 py-0.5 text-[9px] text-red-400 hover:bg-red-500/20 disabled:opacity-40"
					>
						Disband
					</button>
				</div>
			)}

			{/* Expanded member list */}
			{isExpanded && <TeamMembers teamName={team.name} onRefreshList={onRefreshList} />}

			{/* Confirm dialog */}
			{confirmAction && (
				<ConfirmDialog
					message={`Are you sure you want to ${confirmAction.type} team "${team.name}"?`}
					onConfirm={() => {
						confirmAction.fn();
						setConfirmAction(null);
					}}
					onCancel={() => setConfirmAction(null)}
				/>
			)}
		</div>
	);
}

// --- Main TeamsPanel ---

export function TeamsPanel() {
	const { data, loading, error, refetch } = useNatsLive<TeamsListResponse>({
		requestSubject: SUBJECTS.teams.list(),
		changeSubject: SUBJECTS.teams.changed(),
	});

	const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	const teams = data?.teams ?? [];

	const handleToggle = useCallback((teamName: string) => {
		setExpandedTeam((prev) => (prev === teamName ? null : teamName));
	}, []);

	// Loading state
	if (loading && !data) {
		return (
			<div className="flex h-32 items-center justify-center">
				<p className="text-xs text-[var(--os-text-secondary)]">Loading teams...</p>
			</div>
		);
	}

	// Error state
	if (error && !data) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 p-4">
				<p className="text-xs text-red-400">{error}</p>
				<button type="button" onClick={refetch} className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Header with create button */}
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span className="text-[10px] text-[var(--os-text-muted)]">
					{teams.length} team{teams.length !== 1 ? 's' : ''}
				</span>
				<button
					type="button"
					onClick={() => setShowCreateDialog(true)}
					className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-[var(--os-text-primary)] hover:bg-white/15"
				>
					+ New
				</button>
			</div>

			{/* Team list */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				{teams.length === 0 ? (
					<div className="flex h-24 items-center justify-center">
						<p className="text-xs text-[var(--os-text-muted)]">No teams found</p>
					</div>
				) : (
					teams.map((team) => (
						<TeamRow
							key={team.name}
							team={team}
							isExpanded={expandedTeam === team.name}
							onToggle={() => handleToggle(team.name)}
							onRefreshList={refetch}
						/>
					))
				)}
			</div>

			{/* Error banner (when we have data but polling failed) */}
			{error && data && (
				<div className="shrink-0 border-t border-red-500/20 bg-red-500/5 px-3 py-1">
					<p className="text-[10px] text-red-400">{error}</p>
				</div>
			)}

			{/* Create dialog */}
			{showCreateDialog && <CreateTeamDialog onClose={() => setShowCreateDialog(false)} onCreated={refetch} />}
		</div>
	);
}
