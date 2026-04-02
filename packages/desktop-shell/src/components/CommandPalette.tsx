import { useKhalAuth } from '@khal-os/sdk/app';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAppId, hasAppPermission, useLaunchApp } from '../hooks/useLaunchApp';
import { useDesktopStore } from '../stores/desktop-store';
import type { DesktopEntry } from '../types/desktop-entry';
import { AppIcon } from './app-icon';

const RECENT_APPS_KEY = 'khal-os:recent-apps';
const MAX_RECENT = 5;

function getRecentAppIds(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(RECENT_APPS_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		/* ignore */
	}
	return [];
}

function saveRecentAppId(id: string) {
	try {
		const ids = getRecentAppIds().filter((x) => x !== id);
		ids.unshift(id);
		localStorage.setItem(RECENT_APPS_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
	} catch {
		/* ignore */
	}
}

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	serverPermissions?: string[];
}

export function CommandPalette({ open, onOpenChange, serverPermissions }: CommandPaletteProps) {
	const apps = useDesktopStore((s) => s.apps);
	const launchApp = useLaunchApp();
	const auth = useKhalAuth();
	const permissions = auth?.permissions ?? serverPermissions ?? [];
	const [search, setSearch] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	// Filter apps the user has permission to open
	const availableApps = useMemo(
		() =>
			apps.filter((entry) => {
				const appId = entry.component ?? entry.id;
				return hasAppPermission(appId, permissions);
			}),
		[apps, permissions]
	);

	// Sort alphabetically, then filter by search
	const filteredApps = useMemo(() => {
		const sorted = [...availableApps].sort((a, b) => a.name.localeCompare(b.name));
		if (!search.trim()) return sorted;
		const q = search.toLowerCase();
		return sorted.filter(
			(a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.comment?.toLowerCase().includes(q)
		);
	}, [availableApps, search]);

	const launch = useCallback(
		(entry: DesktopEntry) => {
			saveRecentAppId(entry.id);
			launchApp(entry);
			onOpenChange(false);
		},
		[launchApp, onOpenChange]
	);

	// Reset search when closing
	useEffect(() => {
		if (!open) setSearch('');
	}, [open]);

	// Focus input on open
	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				onOpenChange(false);
			}
		};
		window.addEventListener('keydown', handleKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
	}, [open, onOpenChange]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[9998] flex flex-col items-center pt-[10vh]">
			{/* Backdrop -- dark glass */}
			<div
				className="absolute inset-0 animate-in fade-in-0 duration-150"
				style={{
					background: 'rgba(0, 0, 0, 0.6)',
					backdropFilter: 'blur(40px) saturate(1.4)',
					WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
				}}
				onClick={() => onOpenChange(false)}
				onKeyDown={undefined}
				aria-hidden="true"
			/>

			{/* Search bar */}
			<div
				className="relative z-10 w-full max-w-[480px] mb-8 animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out"
				style={{
					background: 'var(--khal-menu-bg, rgba(20, 20, 20, 0.85))',
					border: '1px solid var(--khal-menu-border, rgba(255, 255, 255, 0.1))',
					borderRadius: 'var(--khal-radius-xl, 16px)',
				}}
			>
				<div className="flex items-center gap-3 px-4 py-3">
					<Search className="h-4 w-4 shrink-0 text-[#FFFFFF66]" />
					<input
						ref={inputRef}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search apps..."
						className="flex-1 bg-transparent text-[14px] text-[#FFFFFFEE] outline-none placeholder:text-[#FFFFFF44]"
					/>
					{search && (
						<button
							type="button"
							onClick={() => {
								setSearch('');
								inputRef.current?.focus();
							}}
							className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-[#FFFFFF1A]"
							aria-label="Clear search"
						>
							<X className="h-3.5 w-3.5 text-[#FFFFFF66]" />
						</button>
					)}
					<kbd
						className="hidden sm:inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[#FFFFFF44]"
						style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
					>
						ESC
					</kbd>
				</div>
			</div>

			{/* App grid */}
			<div
				className="relative z-10 w-full max-w-[640px] max-h-[60vh] overflow-y-auto overflow-x-hidden animate-in fade-in-0 zoom-in-[0.98] duration-200 ease-out px-4"
				style={{
					scrollbarWidth: 'thin',
					scrollbarColor: 'rgba(255,255,255,0.15) transparent',
				}}
			>
				{filteredApps.length === 0 ? (
					<div className="py-16 text-center text-[13px] text-[#FFFFFF66]">No apps found.</div>
				) : (
					<div className="grid grid-cols-4 md:grid-cols-6 gap-4 justify-items-center pb-8">
						{filteredApps.map((entry) => {
							const appId = getAppId(entry);
							return (
								<button
									key={entry.id}
									type="button"
									onClick={() => launch(entry)}
									className="group flex w-[88px] flex-col items-center gap-2 rounded-xl p-2 transition-colors hover:bg-[#FFFFFF0F] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFFFFF33]"
								>
									<div
										className="flex h-16 w-16 items-center justify-center rounded-[10px] bg-[#FFFFFF0A] transition-transform group-hover:scale-105"
										style={{ border: '1px solid rgba(255, 255, 255, 0.06)' }}
									>
										<AppIcon appId={appId} size={48} />
									</div>
									<span className="w-full truncate text-center text-[11px] font-medium text-[#FFFFFFCC]">
										{entry.name}
									</span>
								</button>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
