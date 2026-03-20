'use client';

import { SUBJECTS } from '../../../../lib/subjects';
import { useNatsRequest } from '../hooks/useNatsRequest';

// --- Types matching service/system.ts responses ---

interface DoctorCheck {
	name: string;
	status: 'pass' | 'warn' | 'fail';
	detail: string;
}

interface DoctorResult {
	prerequisites: DoctorCheck[];
	configuration: DoctorCheck[];
	tmux: DoctorCheck[];
	workerProfiles: DoctorCheck[];
	error?: string;
}

interface VersionResult {
	version: string;
	error?: string;
}

// --- Section config ---

const SECTION_LABELS: Record<keyof Omit<DoctorResult, 'error'>, string> = {
	prerequisites: 'Prerequisites',
	configuration: 'Configuration',
	tmux: 'Tmux',
	workerProfiles: 'Worker Profiles',
};

const SECTION_KEYS = Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[];

// --- Status helpers ---

function statusIcon(status: 'pass' | 'warn' | 'fail') {
	switch (status) {
		case 'pass':
			return <span className="text-green-400">&#10003;</span>;
		case 'warn':
			return <span className="text-yellow-400">!</span>;
		case 'fail':
			return <span className="text-red-400">&#10007;</span>;
	}
}

function statusColor(status: 'pass' | 'warn' | 'fail') {
	switch (status) {
		case 'pass':
			return 'text-green-400';
		case 'warn':
			return 'text-yellow-400';
		case 'fail':
			return 'text-red-400';
	}
}

function summarize(doctor: DoctorResult): { warnings: number; failures: number; total: number } {
	let warnings = 0;
	let failures = 0;
	let total = 0;

	for (const key of SECTION_KEYS) {
		const checks = doctor[key];
		if (!checks) continue;
		for (const check of checks) {
			total++;
			if (check.status === 'warn') warnings++;
			if (check.status === 'fail') failures++;
		}
	}

	return { warnings, failures, total };
}

// --- Components ---

function CheckRow({ check }: { check: DoctorCheck }) {
	return (
		<div className="flex items-start gap-2 py-1 px-2">
			<span className="mt-0.5 shrink-0 w-4 text-center font-mono text-xs">{statusIcon(check.status)}</span>
			<span className={`text-xs ${statusColor(check.status)} break-all`}>{check.detail}</span>
		</div>
	);
}

function DoctorSection({ label, checks }: { label: string; checks: DoctorCheck[] }) {
	if (checks.length === 0) return null;

	return (
		<div className="mb-3">
			<h4 className="text-xs font-semibold text-[var(--os-text-primary)] px-2 mb-1">{label}</h4>
			{checks.map((check, i) => (
				<CheckRow key={`${check.name}-${i}`} check={check} />
			))}
		</div>
	);
}

function DoctorSummary({ doctor }: { doctor: DoctorResult }) {
	const { warnings, failures } = summarize(doctor);

	if (failures === 0 && warnings === 0) {
		return <p className="text-xs text-green-400">All checks passed</p>;
	}

	return (
		<p className="text-xs text-[var(--os-text-secondary)]">
			{warnings > 0 && (
				<span className="text-yellow-400">
					{warnings} warning{warnings !== 1 ? 's' : ''}
				</span>
			)}
			{warnings > 0 && failures > 0 && ', '}
			{failures > 0 && (
				<span className="text-red-400">
					{failures} failure{failures !== 1 ? 's' : ''}
				</span>
			)}
		</p>
	);
}

function VersionCard() {
	const { data, loading, error } = useNatsRequest<VersionResult>(
		SUBJECTS.system.version(),
		undefined,
		0 // no polling — version doesn't change
	);

	return (
		<div className="rounded-md bg-white/5 p-3">
			<h3 className="text-xs font-semibold text-[var(--os-text-secondary)] mb-1">Version</h3>
			{loading && <p className="text-xs text-[var(--os-text-secondary)]">Loading...</p>}
			{!loading && error && <p className="text-xs text-red-400">{error}</p>}
			{!loading && !error && data?.error && <p className="text-xs text-red-400">{data.error}</p>}
			{!loading && !error && !data?.error && (
				<p className="text-sm font-mono text-[var(--os-text-primary)]">{data?.version ?? 'unknown'}</p>
			)}
		</div>
	);
}

function DoctorCard() {
	const { data, loading, error, refetch } = useNatsRequest<DoctorResult>(
		SUBJECTS.system.doctor(),
		undefined,
		0 // manual refresh only — doctor is expensive
	);

	return (
		<div className="rounded-md bg-white/5 p-3">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-xs font-semibold text-[var(--os-text-secondary)]">Health Checks</h3>
				<button
					type="button"
					onClick={refetch}
					disabled={loading}
					className="rounded px-2 py-0.5 text-xs bg-white/10 text-[var(--os-text-secondary)] hover:bg-white/20 hover:text-[var(--os-text-primary)] disabled:opacity-50 transition-colors"
				>
					{loading ? 'Checking...' : 'Refresh'}
				</button>
			</div>

			{loading && <p className="text-xs text-[var(--os-text-secondary)]">Running doctor checks...</p>}
			{!loading && error && <p className="text-xs text-red-400">{error}</p>}
			{!loading && !error && data?.error && <p className="text-xs text-red-400">{data.error}</p>}
			{!loading && !error && data && !data.error && (
				<>
					{SECTION_KEYS.map((key) => (
						<DoctorSection key={key} label={SECTION_LABELS[key]} checks={data[key] ?? []} />
					))}
					<div className="mt-2 border-t border-white/10 pt-2 px-2">
						<DoctorSummary doctor={data} />
					</div>
				</>
			)}
		</div>
	);
}

// --- Main panel ---

export function SystemPanel() {
	return (
		<div className="flex flex-col gap-4 p-3">
			<VersionCard />
			<DoctorCard />
		</div>
	);
}
