'use client';

import { useCallback, useState } from 'react';
import { SUBJECTS } from '../../../../lib/subjects';
import { useNatsAction } from '../hooks/useNatsAction';
import { useNatsLive } from '../hooks/useNatsLive';

// --- Types matching service/wishes.ts responses ---

interface WishEntry {
	slug: string;
	status: string | null;
	date: string | null;
	summary: string | null;
}

interface WishListResponse {
	wishes: WishEntry[];
	error?: string;
}

interface WishGroup {
	group: number | string;
	status: string;
	assignee: string | null;
	started: string | null;
	completed: string | null;
}

interface WishStatusResponse {
	groups: WishGroup[];
	summary: string;
	error?: string;
}

interface ActionResponse {
	ok?: boolean;
	error?: string;
	output?: string;
}

// --- Status badge config ---

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
	draft: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
	ready: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
	ship: { bg: 'bg-green-500/20', text: 'text-green-400' },
	shipped: { bg: 'bg-green-500/20', text: 'text-green-400' },
	in_progress: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
	blocked: { bg: 'bg-red-500/20', text: 'text-red-400' },
	done: { bg: 'bg-green-500/20', text: 'text-green-400' },
	failed: { bg: 'bg-red-500/20', text: 'text-red-400' },
	pending: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
	review: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

function getStatusBadge(status: string | null) {
	const key = (status ?? 'draft').toLowerCase();
	return STATUS_BADGE[key] ?? STATUS_BADGE.draft;
}

// --- Progress bar helpers ---

const STATUS_TO_BUCKET: Record<string, string> = {
	done: 'done',
	in_progress: 'in_progress',
	ready: 'ready',
	pending: 'ready',
	blocked: 'blocked',
	failed: 'blocked',
};

const PROGRESS_SEGMENTS = [
	{ key: 'done', barClass: 'bg-green-500', labelClass: 'text-green-400', label: 'done' },
	{ key: 'in_progress', barClass: 'bg-yellow-500', labelClass: 'text-yellow-400', label: 'in progress' },
	{ key: 'ready', barClass: 'bg-blue-500', labelClass: 'text-blue-400', label: 'ready' },
	{ key: 'blocked', barClass: 'bg-red-500', labelClass: 'text-red-400', label: 'blocked' },
	{ key: 'other', barClass: 'bg-gray-500', labelClass: 'text-gray-400', label: 'other' },
] as const;

function countByBucket(groups: WishGroup[]): Record<string, number> {
	const counts: Record<string, number> = { done: 0, in_progress: 0, ready: 0, blocked: 0, other: 0 };
	for (const g of groups) {
		const bucket = STATUS_TO_BUCKET[g.status.toLowerCase()] ?? 'other';
		counts[bucket]++;
	}
	return counts;
}

// --- Progress bar component ---

function GroupProgressBar({ groups }: { groups: WishGroup[] }) {
	const total = groups.length;
	if (total === 0) return null;

	const counts = countByBucket(groups);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex h-2 rounded-full overflow-hidden bg-white/5">
				{PROGRESS_SEGMENTS.map(
					(seg) =>
						counts[seg.key] > 0 && (
							<div
								key={seg.key}
								className={`${seg.barClass} transition-all`}
								style={{ width: `${(counts[seg.key] / total) * 100}%` }}
							/>
						)
				)}
			</div>
			<div className="flex gap-2 text-[10px] text-[var(--os-text-secondary)]">
				{PROGRESS_SEGMENTS.map(
					(seg) =>
						counts[seg.key] > 0 && (
							<span key={seg.key} className={seg.labelClass}>
								{counts[seg.key]} {seg.label}
							</span>
						)
				)}
			</div>
		</div>
	);
}

// --- Group row component ---

function GroupRow({
	group,
	wishSlug,
	onDone,
	onReset,
	actionLoading,
}: {
	group: WishGroup;
	wishSlug: string;
	onDone: (ref: string) => void;
	onReset: (ref: string) => void;
	actionLoading: boolean;
}) {
	const badge = getStatusBadge(group.status);
	const ref = `${wishSlug}#${group.group}`;

	return (
		<div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 group/row">
			<span className="text-xs font-mono text-[var(--os-text-secondary)] w-8 shrink-0">#{String(group.group)}</span>
			<span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text} shrink-0`}>{group.status}</span>
			<span className="text-xs text-[var(--os-text-secondary)] truncate flex-1">{group.assignee ?? '—'}</span>
			{group.started && (
				<span className="text-[10px] text-[var(--os-text-secondary)] shrink-0 hidden sm:inline">{group.started}</span>
			)}
			<div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
				{group.status !== 'done' && (
					<button
						type="button"
						onClick={() => onDone(ref)}
						disabled={actionLoading}
						className="rounded px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
					>
						Done
					</button>
				)}
				<button
					type="button"
					onClick={() => onReset(ref)}
					disabled={actionLoading}
					className="rounded px-1.5 py-0.5 text-[10px] bg-white/10 text-[var(--os-text-secondary)] hover:bg-white/20 disabled:opacity-50"
				>
					Reset
				</button>
			</div>
		</div>
	);
}

// --- Expanded wish detail ---

function WishDetail({
	slug,
	onDone,
	onReset,
	actionLoading,
}: {
	slug: string;
	onDone: (ref: string) => void;
	onReset: (ref: string) => void;
	actionLoading: boolean;
}) {
	const { data, loading, error } = useNatsLive<WishStatusResponse>({
		requestSubject: SUBJECTS.wish.status(),
		changeSubject: SUBJECTS.wish.changed(),
		payload: { slug },
		usePushPayload: false,
	});

	if (loading) {
		return <p className="text-xs text-[var(--os-text-secondary)] px-2 py-1">Loading groups...</p>;
	}

	if (error) {
		return <p className="text-xs text-red-400 px-2 py-1">{error}</p>;
	}

	if (data?.error) {
		return <p className="text-xs text-red-400 px-2 py-1">{data.error}</p>;
	}

	if (!data?.groups || data.groups.length === 0) {
		return <p className="text-xs text-[var(--os-text-secondary)] px-2 py-1">No groups found</p>;
	}

	return (
		<div className="flex flex-col gap-1 pt-1">
			<GroupProgressBar groups={data.groups} />
			<div className="flex flex-col mt-1">
				{data.groups.map((g) => (
					<GroupRow
						key={String(g.group)}
						group={g}
						wishSlug={slug}
						onDone={onDone}
						onReset={onReset}
						actionLoading={actionLoading}
					/>
				))}
			</div>
			{data.summary && (
				<p className="text-[10px] text-[var(--os-text-secondary)] px-2 mt-1 border-t border-white/10 pt-1">
					{data.summary}
				</p>
			)}
		</div>
	);
}

// --- Main panel ---

export function WishesPanel() {
	const { data, loading, error, refetch } = useNatsLive<WishListResponse>({
		requestSubject: SUBJECTS.wish.list(),
		changeSubject: SUBJECTS.wish.changed(),
	});

	const { execute: execWork, loading: workLoading } = useNatsAction<ActionResponse>(SUBJECTS.wish.work());
	const { execute: execDone, loading: doneLoading } = useNatsAction<ActionResponse>(SUBJECTS.wish.done());
	const { execute: execReset, loading: resetLoading } = useNatsAction<ActionResponse>(SUBJECTS.wish.reset());

	const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
	const [actionFeedback, setActionFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);

	const actionLoading = workLoading || doneLoading || resetLoading;

	const showFeedback = useCallback((type: 'ok' | 'error', msg: string) => {
		setActionFeedback({ type, msg });
		setTimeout(() => setActionFeedback(null), 3000);
	}, []);

	const handleWork = useCallback(
		async (ref: string) => {
			try {
				const res = await execWork({ ref });
				if (res?.ok) {
					showFeedback('ok', `Work started: ${ref}`);
					refetch();
				} else {
					showFeedback('error', res?.error ?? 'Work failed');
				}
			} catch {
				showFeedback('error', 'Failed to start work');
			}
		},
		[execWork, refetch, showFeedback]
	);

	const handleDone = useCallback(
		async (ref: string) => {
			try {
				const res = await execDone({ ref });
				if (res?.ok) {
					showFeedback('ok', `Marked done: ${ref}`);
					refetch();
				} else {
					showFeedback('error', res?.error ?? 'Failed to mark done');
				}
			} catch {
				showFeedback('error', 'Failed to mark done');
			}
		},
		[execDone, refetch, showFeedback]
	);

	const handleReset = useCallback(
		async (ref: string) => {
			try {
				const res = await execReset({ ref });
				if (res?.ok) {
					showFeedback('ok', `Reset: ${ref}`);
					refetch();
				} else {
					showFeedback('error', res?.error ?? 'Reset failed');
				}
			} catch {
				showFeedback('error', 'Failed to reset');
			}
		},
		[execReset, refetch, showFeedback]
	);

	const toggleExpand = useCallback((slug: string) => {
		setExpandedSlug((prev) => (prev === slug ? null : slug));
	}, []);

	const wishes = data?.wishes ?? [];

	return (
		<div className="flex flex-col gap-2 p-3">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold text-[var(--os-text-secondary)]">
					Wishes{wishes.length > 0 ? ` (${wishes.length})` : ''}
				</h3>
				<button
					type="button"
					onClick={refetch}
					disabled={loading}
					className="rounded px-2 py-0.5 text-xs bg-white/10 text-[var(--os-text-secondary)] hover:bg-white/20 hover:text-[var(--os-text-primary)] disabled:opacity-50 transition-colors"
				>
					{loading ? 'Loading...' : 'Refresh'}
				</button>
			</div>

			{/* Action feedback toast */}
			{actionFeedback && (
				<div
					className={`rounded px-2 py-1 text-xs ${
						actionFeedback.type === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
					}`}
				>
					{actionFeedback.msg}
				</div>
			)}

			{/* Loading state */}
			{loading && wishes.length === 0 && <p className="text-xs text-[var(--os-text-secondary)]">Loading wishes...</p>}

			{/* Error state */}
			{error && <p className="text-xs text-red-400">{error}</p>}

			{/* Service-level error */}
			{data?.error && <p className="text-xs text-red-400">{data.error}</p>}

			{/* Empty state */}
			{!loading && !error && wishes.length === 0 && (
				<div className="rounded-md bg-white/5 p-4 text-center">
					<p className="text-xs text-[var(--os-text-secondary)]">No wishes found</p>
				</div>
			)}

			{/* Wish list */}
			{wishes.map((wish) => {
				const badge = getStatusBadge(wish.status);
				const isExpanded = expandedSlug === wish.slug;

				return (
					<div key={wish.slug} className="rounded-md bg-white/5 overflow-hidden">
						{/* Wish row header */}
						<button
							type="button"
							onClick={() => toggleExpand(wish.slug)}
							className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/5 transition-colors group/wish"
						>
							{/* Expand indicator */}
							<span
								className="text-[10px] text-[var(--os-text-secondary)] w-3 shrink-0 transition-transform"
								style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
							>
								&#9654;
							</span>

							{/* Slug */}
							<span className="text-xs font-mono text-[var(--os-text-primary)] truncate flex-1 min-w-0">
								{wish.slug}
							</span>

							{/* Status badge */}
							<span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text} shrink-0`}>
								{wish.status ?? 'DRAFT'}
							</span>
						</button>

						{/* Summary and date */}
						{(wish.summary || wish.date) && (
							<div className="px-2.5 pb-1.5 -mt-1">
								{wish.date && <span className="text-[10px] text-[var(--os-text-secondary)]">{wish.date}</span>}
								{wish.summary && (
									<p className="text-[10px] text-[var(--os-text-secondary)] line-clamp-2 mt-0.5">{wish.summary}</p>
								)}
							</div>
						)}

						{/* Action buttons */}
						<div className="flex gap-1 px-2.5 pb-2">
							<button
								type="button"
								onClick={() => handleWork(wish.slug)}
								disabled={actionLoading}
								className="rounded px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
							>
								Work
							</button>
							<button
								type="button"
								onClick={() => handleReset(wish.slug)}
								disabled={actionLoading}
								className="rounded px-2 py-0.5 text-[10px] bg-white/10 text-[var(--os-text-secondary)] hover:bg-white/20 disabled:opacity-50 transition-colors"
							>
								Reset
							</button>
						</div>

						{/* Expanded group detail */}
						{isExpanded && (
							<div className="border-t border-white/10 px-2 py-2">
								<WishDetail slug={wish.slug} onDone={handleDone} onReset={handleReset} actionLoading={actionLoading} />
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
