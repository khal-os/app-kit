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
import { and, avg, count, eq, inArray, sql } from '@khal-os/sdk/db/operators';
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

/**
 * Resolve an appId that might be a slug to the actual app_store UUID.
 * If the value matches a slug in app_store, returns the row's id.
 * Otherwise assumes it is already a UUID and returns as-is.
 */
async function resolveAppId(appIdOrSlug: string): Promise<string> {
	const rows = await db()
		.select({ id: schema.appStore.id })
		.from(schema.appStore)
		.where(eq(schema.appStore.slug, appIdOrSlug))
		.limit(1);
	return rows.length > 0 ? rows[0].id : appIdOrSlug;
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
					itemType?: string;
					contents?: Array<{ slug: string; itemType: string; required: boolean }>;
					agentConfig?: unknown;
					ideaId?: string;
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
						itemType:
							(req.itemType as 'app' | 'workflow' | 'skill' | 'template' | 'stack' | 'agent' | 'board' | 'hook') ??
							'app',
						contents: req.contents,
						agentConfig: req.agentConfig,
						ideaId: req.ideaId,
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
							itemType:
								(req.itemType as 'app' | 'workflow' | 'skill' | 'template' | 'stack' | 'agent' | 'board' | 'hook') ??
								'app',
							contents: req.contents,
							agentConfig: req.agentConfig,
							ideaId: req.ideaId,
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

				// Stack-aware install: if this is a stack with contents, install all contained items transactionally
				let stackItems = 0;
				if (storeEntry.itemType === 'stack' && Array.isArray(req.contents) && req.contents.length > 0) {
					await db().transaction(async (tx) => {
						for (const item of req.contents!) {
							// Look up the contained app in app_store by slug
							const [found] = await tx
								.select()
								.from(schema.appStore)
								.where(eq(schema.appStore.slug, item.slug))
								.limit(1);

							if (!found) {
								if (item.required) {
									throw new Error(`Required stack item not found in app_store: ${item.slug}`);
								}
								// Optional item not found — skip
								continue;
							}

							// Upsert the contained item into installed_apps
							await tx
								.insert(schema.installedApps)
								.values({
									appId: found.id,
									slug: found.slug,
									path: req.path,
									status: 'installed',
								})
								.onConflictDoUpdate({
									target: schema.installedApps.slug,
									set: {
										appId: found.id,
										path: req.path,
										status: 'installed',
									},
								});

							stackItems++;
						}
					});
				}

				msg.respond(JSON.stringify({ ok: true, storeEntry, installed, stackItems }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Unregister app (delete from installed_apps, stack-aware) ---
	{
		subject: SUBJECTS.apps.unregister(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ slug: string }>();
				if (!req.slug) {
					msg.respond(JSON.stringify({ ok: false, error: 'slug is required' }));
					return;
				}

				// Check if this is a stack — if so, uninstall all contained items first
				let stackItemsRemoved = 0;
				const [storeRow] = await db()
					.select({ itemType: schema.appStore.itemType, contents: schema.appStore.contents })
					.from(schema.appStore)
					.where(eq(schema.appStore.slug, req.slug))
					.limit(1);

				if (storeRow?.itemType === 'stack' && Array.isArray(storeRow.contents) && storeRow.contents.length > 0) {
					const contentSlugs = (storeRow.contents as Array<{ slug: string }>).map((c) => c.slug);
					const removedItems = await db()
						.delete(schema.installedApps)
						.where(inArray(schema.installedApps.slug, contentSlugs))
						.returning();
					stackItemsRemoved = removedItems.length;
				}

				// Delete the app/stack itself from installed_apps
				const deleted = await db()
					.delete(schema.installedApps)
					.where(eq(schema.installedApps.slug, req.slug))
					.returning();

				msg.respond(JSON.stringify({ ok: true, removed: deleted.length, stackItemsRemoved }));
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

	// --- Run: start (insert into app_runs with status running) ---
	{
		subject: SUBJECTS.apps.run.start(),
		handler: async (msg) => {
			try {
				const req = msg.json<{
					appId: string;
					appVersion?: string;
					userId?: string;
					agentId?: string;
					automationId?: string;
					trigger?: string;
					metadata?: unknown;
				}>();

				if (!req.appId) {
					msg.respond(JSON.stringify({ ok: false, error: 'appId is required' }));
					return;
				}

				const appId = await resolveAppId(req.appId);

				const [run] = await db()
					.insert(schema.appRuns)
					.values({
						appId,
						appVersion: req.appVersion,
						userId: req.userId,
						agentId: req.agentId,
						automationId: req.automationId,
						trigger: (req.trigger as 'manual' | 'scheduled' | 'agent' | 'automation') ?? 'manual',
						status: 'running',
						metadata: req.metadata,
					})
					.returning();

				msg.respond(JSON.stringify({ ok: true, runId: run.id }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Run: end (update app_runs with status, cost, trace, output) ---
	{
		subject: SUBJECTS.apps.run.end(),
		handler: async (msg) => {
			try {
				const req = msg.json<{
					runId: string;
					status: string;
					costTokens?: number;
					costComputeMs?: number;
					costApiCalls?: number;
					outputSummary?: string;
					agentTrace?: unknown;
					metadata?: unknown;
				}>();

				if (!req.runId || !req.status) {
					msg.respond(JSON.stringify({ ok: false, error: 'runId and status are required' }));
					return;
				}

				// Fetch the run to calculate duration
				const existing = await db()
					.select({ startedAt: schema.appRuns.startedAt })
					.from(schema.appRuns)
					.where(eq(schema.appRuns.id, req.runId))
					.limit(1);

				if (existing.length === 0) {
					msg.respond(JSON.stringify({ ok: false, error: 'Run not found' }));
					return;
				}

				const now = new Date();
				const durationMs = now.getTime() - existing[0].startedAt.getTime();

				await db()
					.update(schema.appRuns)
					.set({
						status: req.status as 'running' | 'success' | 'failure' | 'error' | 'timeout',
						endedAt: now,
						durationMs,
						costTokens: req.costTokens,
						costComputeMs: req.costComputeMs,
						costApiCalls: req.costApiCalls,
						outputSummary: req.outputSummary,
						agentTrace: req.agentTrace,
						metadata: req.metadata,
					})
					.where(eq(schema.appRuns.id, req.runId));

				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Run: list (paginated runs for an app) ---
	{
		subject: SUBJECTS.apps.run.list(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ appId: string; limit?: number; offset?: number }>();

				if (!req.appId) {
					msg.respond(JSON.stringify({ error: 'appId is required', runs: [] }));
					return;
				}

				const appId = await resolveAppId(req.appId);
				const limit = req.limit ?? 50;
				const offset = req.offset ?? 0;

				const runs = await db()
					.select()
					.from(schema.appRuns)
					.where(eq(schema.appRuns.appId, appId))
					.orderBy(sql`${schema.appRuns.startedAt} desc`)
					.limit(limit)
					.offset(offset);

				msg.respond(JSON.stringify({ runs }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), runs: [] }));
			}
		},
	},

	// --- Vote: insert into app_votes (idempotent) ---
	{
		subject: SUBJECTS.apps.vote(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ userId: string; appId: string }>();

				if (!req.userId || !req.appId) {
					msg.respond(JSON.stringify({ ok: false, error: 'userId and appId are required' }));
					return;
				}

				const appId = await resolveAppId(req.appId);

				await db().insert(schema.appVotes).values({ userId: req.userId, appId }).onConflictDoNothing();

				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Unvote: delete from app_votes ---
	{
		subject: SUBJECTS.apps.unvote(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ userId: string; appId: string }>();

				if (!req.userId || !req.appId) {
					msg.respond(JSON.stringify({ ok: false, error: 'userId and appId are required' }));
					return;
				}

				const appId = await resolveAppId(req.appId);

				await db()
					.delete(schema.appVotes)
					.where(and(eq(schema.appVotes.userId, req.userId), eq(schema.appVotes.appId, appId)));

				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Metrics: aggregated stats for an app ---
	{
		subject: SUBJECTS.apps.metrics(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ appId: string }>();

				if (!req.appId) {
					msg.respond(JSON.stringify({ error: 'appId is required' }));
					return;
				}

				const appId = await resolveAppId(req.appId);

				// Aggregate run stats
				const [runStats] = await db()
					.select({
						totalRuns: count(),
						avgDurationMs: avg(schema.appRuns.durationMs),
						successCount: count(sql`case when ${schema.appRuns.status} = 'success' then 1 end`),
					})
					.from(schema.appRuns)
					.where(eq(schema.appRuns.appId, appId));

				// Count votes
				const [voteStats] = await db()
					.select({ voteCount: count() })
					.from(schema.appVotes)
					.where(eq(schema.appVotes.appId, appId));

				const totalRuns = runStats?.totalRuns ?? 0;
				const avgDurationMs = runStats?.avgDurationMs ? Number(runStats.avgDurationMs) : null;
				const successRate = totalRuns > 0 ? (runStats?.successCount ?? 0) / totalRuns : null;
				const voteCount = voteStats?.voteCount ?? 0;

				msg.respond(JSON.stringify({ totalRuns, avgDurationMs, successRate, voteCount }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
];
