'use client';

import { getNatsClient, hasMinRole, normalizeRole, useKhalAuth } from '@khal-os/sdk/app';
import { Spinner } from '@khal-os/ui';
import type { Role } from '@khal-os/types';
import { useCallback, useEffect, useState } from 'react';
import { useDesktopStore } from '../../stores/desktop-store';
import { AppCard, type StoreEntry } from './AppCard';

/** Response shape from `os.apps.store.list`. */
interface StoreCatalogResponse {
	apps?: StoreEntry[];
	error?: string;
}

export function MarketplaceView() {
	const auth = useKhalAuth();
	const fetchApps = useDesktopStore((s) => s.fetchApps);
	const desktopApps = useDesktopStore((s) => s.apps);

	const [catalog, setCatalog] = useState<StoreEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [installingSet, setInstallingSet] = useState<Set<string>>(new Set());
	const [uninstallingSet, setUninstallingSet] = useState<Set<string>>(new Set());

	// Set of currently installed app slugs (derived from desktop store)
	const installedSlugs = new Set(desktopApps.map((a) => a.id));

	// Fetch store catalog
	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const client = getNatsClient();
				const raw = await client.request('os.apps.store.list', undefined, 8000);
				const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as StoreCatalogResponse;
				if (!cancelled) {
					setCatalog(data.apps ?? []);
					setLoading(false);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
					setLoading(false);
				}
			}
		}
		load();
		return () => { cancelled = true; };
	}, []);

	// RBAC check: does the user meet the app's minRole?
	const userRole = normalizeRole(auth?.role);
	const isAuthorized = useCallback(
		(app: StoreEntry): boolean => {
			if (!app.minRole) return true;
			return hasMinRole(userRole, normalizeRole(app.minRole) as Role);
		},
		[userRole],
	);

	const handleInstall = useCallback(
		async (slug: string) => {
			setInstallingSet((prev) => new Set(prev).add(slug));
			try {
				const client = getNatsClient();
				await client.request('os.apps.register', { slug }, 15000);
				// Refresh desktop app list so the new app appears
				await fetchApps();
			} catch (err) {
				console.error(`[Marketplace] install failed for ${slug}:`, err);
			} finally {
				setInstallingSet((prev) => {
					const next = new Set(prev);
					next.delete(slug);
					return next;
				});
			}
		},
		[fetchApps],
	);

	const handleUninstall = useCallback(
		async (slug: string) => {
			if (!window.confirm(`Uninstall ${slug}? This will remove the app and any associated resources.`)) return;
			setUninstallingSet((prev) => new Set(prev).add(slug));
			try {
				const client = getNatsClient();
				await client.request('os.apps.unregister', { slug }, 15000);
				await fetchApps();
			} catch (err) {
				console.error(`[Marketplace] uninstall failed for ${slug}:`, err);
			} finally {
				setUninstallingSet((prev) => {
					const next = new Set(prev);
					next.delete(slug);
					return next;
				});
			}
		},
		[fetchApps],
	);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner size="lg" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 p-8">
				<p className="text-sm" style={{ color: 'var(--khal-text-secondary)' }}>
					Failed to load app catalog
				</p>
				<p className="text-xs" style={{ color: 'var(--khal-text-muted)' }}>
					{error}
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Header */}
			<div className="shrink-0 border-b px-6 py-4" style={{ borderColor: 'var(--khal-border-default)' }}>
				<h1 className="text-lg font-semibold" style={{ color: 'var(--khal-text-primary)' }}>
					App Store
				</h1>
				<p className="mt-1 text-xs" style={{ color: 'var(--khal-text-secondary)' }}>
					Browse and install apps for your workspace
				</p>
			</div>

			{/* App grid */}
			<div className="flex-1 overflow-y-auto p-6">
				{catalog.length === 0 ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-sm" style={{ color: 'var(--khal-text-muted)' }}>No apps available</p>
					</div>
				) : (
					<div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
						{catalog.map((app) => (
							<AppCard
								key={app.slug}
								app={app}
								installed={installedSlugs.has(app.slug)}
								authorized={isAuthorized(app)}
								installing={installingSet.has(app.slug)}
								uninstalling={uninstallingSet.has(app.slug)}
								onInstall={handleInstall}
								onUninstall={handleUninstall}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
