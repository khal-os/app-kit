/**
 * Apps domain — NATS handlers for app store & installation management.
 *
 * Endpoints:
 *   os.genie.apps.list          — list installed apps with store metadata
 *   os.genie.apps.get           — get single app by slug
 *   os.genie.apps.register      — register app (upsert store + install)
 *   os.genie.apps.unregister    — uninstall app (delete from installed_apps)
 *   os.genie.apps.store.list    — list approved apps in the store
 *   os.genie.apps.store.submit  — submit app for review
 *   os.genie.apps.store.approve — approve a submitted app
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDatabaseUrl, getDb, initDb, isDbInitialized } from '@khal-os/sdk';
import { eq } from '@khal-os/sdk/db/operators';
import * as schema from '@khal-os/sdk/db/schema';
import type { ServiceHandler } from '@khal-os/sdk/service';
import { SUBJECTS } from '../../../lib/subjects';

/** Ensure DB is initialized before first use. */
function db() {
	if (!isDbInitialized()) {
		initDb({ schema, getDatabaseUrl });
	}
	return getDb();
}

/** Mission Control manifest — hardcoded since it has no package with manifest.ts. */
const MISSION_CONTROL_MANIFEST = {
	id: 'mission-control',
	views: [
		{
			id: 'mission-control',
			label: 'Mission Control',
			permission: 'mission-control',
			minRole: 'member',
			natsPrefix: 'task',
			defaultSize: { width: 1200, height: 800 },
		},
	],
	desktop: {
		icon: '/icons/dusk/mission_control.svg',
		categories: ['System'],
		comment: 'See all your tasks flow through stages',
	},
};

interface ManifestView {
	id: string;
	label: string;
	permission?: string;
	minRole?: string;
	natsPrefix?: string;
	defaultSize?: { width: number; height: number };
	fullSizeContent?: boolean;
	component?: string;
}

interface PackageManifest {
	id: string;
	views: ManifestView[];
	desktop?: {
		icon?: string;
		categories?: string[];
		comment?: string;
	};
}

/**
 * Seed core apps from package manifests into app_store + installed_apps.
 * Idempotent — uses ON CONFLICT DO UPDATE so restarts don't create duplicates.
 */
export async function seedCoreApps(): Promise<void> {
	const packagesDir = resolve(process.cwd(), 'packages');
	const manifests: { manifest: PackageManifest; pkgDir: string }[] = [];

	// Discover package manifests
	if (existsSync(packagesDir)) {
		const entries = readdirSync(packagesDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const manifestPath = resolve(packagesDir, entry.name, 'manifest.ts');
			if (!existsSync(manifestPath)) continue;

			try {
				const mod = await import(manifestPath);
				manifests.push({
					manifest: mod.default as PackageManifest,
					pkgDir: resolve(packagesDir, entry.name),
				});
			} catch (err) {
				console.warn(`[apps-service] failed to import manifest from ${entry.name}:`, err);
			}
		}
	}

	// Add mission-control (no package, hardcoded manifest)
	manifests.push({
		manifest: MISSION_CONTROL_MANIFEST,
		pkgDir: resolve(packagesDir, 'mission-control'),
	});

	// Upsert each manifest's primary view into app_store + installed_apps
	for (const { manifest, pkgDir } of manifests) {
		const view = manifest.views[0];
		if (!view) continue;

		try {
			const [storeEntry] = await db()
				.insert(schema.appStore)
				.values({
					slug: view.id,
					name: view.label,
					repoUrl: `local://packages/${manifest.id}`,
					iconLucide: manifest.desktop?.icon,
					shortDescription: manifest.desktop?.comment,
					category: manifest.desktop?.categories?.[0],
					isOfficial: true,
					approvalStatus: 'approved',
					permission: view.permission,
					natsPrefix: view.natsPrefix,
					defaultWidth: view.defaultSize?.width,
					defaultHeight: view.defaultSize?.height,
					fullSizeContent: view.fullSizeContent ?? false,
					minRole: view.minRole,
					manifestJson: manifest,
				})
				.onConflictDoUpdate({
					target: schema.appStore.slug,
					set: {
						name: view.label,
						manifestJson: manifest,
						updatedAt: new Date(),
					},
				})
				.returning();

			await db()
				.insert(schema.installedApps)
				.values({
					appId: storeEntry.id,
					slug: view.id,
					path: pkgDir,
					status: 'installed',
				})
				.onConflictDoUpdate({
					target: schema.installedApps.slug,
					set: {
						appId: storeEntry.id,
						path: pkgDir,
						status: 'installed',
					},
				});

			console.log(`[apps-service] seeded core app: ${view.id}`);
		} catch (err) {
			console.warn(`[apps-service] failed to seed ${view.id}:`, err);
		}
	}
}

export const appsHandlers: ServiceHandler[] = [
	// --- List installed apps with store metadata ---
	{
		subject: SUBJECTS.apps.list(),
		handler: async (msg) => {
			try {
				const rows = await db()
					.select()
					.from(schema.installedApps)
					.leftJoin(schema.appStore, eq(schema.installedApps.appId, schema.appStore.id));

				const apps = rows.map((r) => ({
					...r.installed_apps,
					store: r.app_store,
				}));
				msg.respond(JSON.stringify({ apps }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), apps: [] }));
			}
		},
	},

	// --- Get single app by slug ---
	{
		subject: SUBJECTS.apps.get(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ slug: string }>();
				if (!req.slug) {
					msg.respond(JSON.stringify({ error: 'slug is required' }));
					return;
				}

				const rows = await db()
					.select()
					.from(schema.installedApps)
					.leftJoin(schema.appStore, eq(schema.installedApps.appId, schema.appStore.id))
					.where(eq(schema.installedApps.slug, req.slug))
					.limit(1);

				if (rows.length === 0) {
					msg.respond(JSON.stringify({ error: 'App not found' }));
					return;
				}

				const app = { ...rows[0].installed_apps, store: rows[0].app_store };
				msg.respond(JSON.stringify({ app }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Register app (upsert into app_store + insert into installed_apps) ---
	{
		subject: SUBJECTS.apps.register(),
		handler: async (msg) => {
			try {
				const req = msg.json<{
					slug: string;
					name: string;
					repoUrl: string;
					path: string;
					iconUrl?: string;
					iconLucide?: string;
					shortDescription?: string;
					description?: string;
					category?: string;
					tags?: string[];
					isOfficial?: boolean;
					authorName?: string;
					authorUrl?: string;
					authorVerified?: boolean;
					version?: string;
					license?: string;
					minRole?: string;
					permission?: string;
					natsPrefix?: string;
					defaultWidth?: number;
					defaultHeight?: number;
					fullSizeContent?: boolean;
					manifestJson?: unknown;
					approvalStatus?: 'pending' | 'approved' | 'rejected';
				}>();

				if (!req.slug || !req.name || !req.repoUrl || !req.path) {
					msg.respond(JSON.stringify({ ok: false, error: 'slug, name, repoUrl, and path are required' }));
					return;
				}

				// Upsert into app_store
				const [storeEntry] = await db()
					.insert(schema.appStore)
					.values({
						slug: req.slug,
						name: req.name,
						repoUrl: req.repoUrl,
						iconUrl: req.iconUrl,
						iconLucide: req.iconLucide,
						shortDescription: req.shortDescription,
						description: req.description,
						category: req.category,
						tags: req.tags,
						isOfficial: req.isOfficial ?? false,
						authorName: req.authorName,
						authorUrl: req.authorUrl,
						authorVerified: req.authorVerified ?? false,
						version: req.version,
						license: req.license,
						minRole: req.minRole,
						permission: req.permission,
						natsPrefix: req.natsPrefix,
						defaultWidth: req.defaultWidth,
						defaultHeight: req.defaultHeight,
						fullSizeContent: req.fullSizeContent ?? false,
						manifestJson: req.manifestJson,
						currentVersion: req.version,
						approvalStatus: req.approvalStatus ?? 'pending',
					})
					.onConflictDoUpdate({
						target: schema.appStore.slug,
						set: {
							name: req.name,
							repoUrl: req.repoUrl,
							iconUrl: req.iconUrl,
							iconLucide: req.iconLucide,
							shortDescription: req.shortDescription,
							description: req.description,
							version: req.version,
							manifestJson: req.manifestJson,
							updatedAt: new Date(),
						},
					})
					.returning();

				// Upsert into installed_apps (slug is unique)
				const [installed] = await db()
					.insert(schema.installedApps)
					.values({
						appId: storeEntry.id,
						slug: req.slug,
						path: req.path,
						status: 'installed',
					})
					.onConflictDoUpdate({
						target: schema.installedApps.slug,
						set: {
							appId: storeEntry.id,
							path: req.path,
							status: 'installed',
						},
					})
					.returning();

				msg.respond(JSON.stringify({ ok: true, storeEntry, installed }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Unregister app (delete from installed_apps) ---
	{
		subject: SUBJECTS.apps.unregister(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ slug: string }>();
				if (!req.slug) {
					msg.respond(JSON.stringify({ ok: false, error: 'slug is required' }));
					return;
				}

				const deleted = await db()
					.delete(schema.installedApps)
					.where(eq(schema.installedApps.slug, req.slug))
					.returning();

				msg.respond(JSON.stringify({ ok: true, removed: deleted.length }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Store: list approved apps ---
	{
		subject: SUBJECTS.apps.store.list(),
		handler: async (msg) => {
			try {
				const rows = await db().select().from(schema.appStore).where(eq(schema.appStore.approvalStatus, 'approved'));

				msg.respond(JSON.stringify({ apps: rows }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), apps: [] }));
			}
		},
	},

	// --- Store: submit app for review ---
	{
		subject: SUBJECTS.apps.store.submit(),
		handler: async (msg) => {
			try {
				const req = msg.json<{
					slug: string;
					name: string;
					repoUrl: string;
					shortDescription?: string;
					description?: string;
					authorName?: string;
					authorUrl?: string;
					category?: string;
					tags?: string[];
					manifestJson?: unknown;
					submittedBy?: string;
				}>();

				if (!req.slug || !req.name || !req.repoUrl) {
					msg.respond(JSON.stringify({ ok: false, error: 'slug, name, and repoUrl are required' }));
					return;
				}

				const [entry] = await db()
					.insert(schema.appStore)
					.values({
						slug: req.slug,
						name: req.name,
						repoUrl: req.repoUrl,
						shortDescription: req.shortDescription,
						description: req.description,
						authorName: req.authorName,
						authorUrl: req.authorUrl,
						category: req.category,
						tags: req.tags,
						manifestJson: req.manifestJson,
						approvalStatus: 'pending',
						submittedBy: req.submittedBy,
						submittedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: schema.appStore.slug,
						set: {
							name: req.name,
							repoUrl: req.repoUrl,
							shortDescription: req.shortDescription,
							description: req.description,
							manifestJson: req.manifestJson,
							approvalStatus: 'pending',
							submittedBy: req.submittedBy,
							submittedAt: new Date(),
							updatedAt: new Date(),
						},
					})
					.returning();

				msg.respond(JSON.stringify({ ok: true, entry }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Store: approve app ---
	{
		subject: SUBJECTS.apps.store.approve(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ slug: string; approvedBy?: string }>();
				if (!req.slug) {
					msg.respond(JSON.stringify({ ok: false, error: 'slug is required' }));
					return;
				}

				const [updated] = await db()
					.update(schema.appStore)
					.set({
						approvalStatus: 'approved',
						approvedBy: req.approvedBy,
						approvedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(schema.appStore.slug, req.slug))
					.returning();

				if (!updated) {
					msg.respond(JSON.stringify({ ok: false, error: 'App not found' }));
					return;
				}

				msg.respond(JSON.stringify({ ok: true, entry: updated }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},
];
