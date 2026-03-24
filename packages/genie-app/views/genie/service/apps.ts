/**
 * Apps domain — NATS handlers for app registry CRUD.
 *
 * Endpoints:
 *   os.genie.apps.list       — list installed apps (JOIN app_store)
 *   os.genie.apps.get        — get app_store entry by slug
 *   os.genie.apps.register   — register app in app_store + installed_apps
 *   os.genie.apps.unregister — remove from installed_apps
 */

import type { ServiceHandler } from '@khal-os/sdk/service';
import { SUBJECTS } from '../../../lib/subjects';

const { getDatabaseUrl } = require('@khal-os/sdk/config') as typeof import('@khal-os/sdk/config');

// biome-ignore lint/suspicious/noExplicitAny: postgres is resolved at runtime from os-sdk
let _sql: any = null;

function sql() {
	if (!_sql) {
		// postgres is installed in @khal-os/sdk — resolved at runtime
		_sql = require('postgres')(getDatabaseUrl(), { max: 5, idle_timeout: 20, connect_timeout: 10 });
	}
	return _sql;
}

/** Build the VALUES tuple for an app_store upsert from a register request. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: flat data mapping, not control flow
function storeDefaults(req: RegisterRequest) {
	return {
		slug: req.slug,
		name: req.name,
		icon_url: req.iconUrl ?? null,
		icon_lucide: req.iconLucide ?? 'box',
		short_description: req.shortDescription ?? null,
		description: req.description ?? null,
		screenshots: req.screenshots ?? [],
		author_name: req.authorName,
		author_url: req.authorUrl ?? null,
		author_verified: req.authorVerified ?? false,
		repo_url: req.repoUrl,
		version: req.version ?? '0.0.1',
		license: req.license ?? null,
		category: req.category ?? 'Productivity',
		tags: req.tags ?? [],
		is_official: req.isOfficial ?? false,
		is_experimental: req.isExperimental ?? false,
		runtime_tier: req.runtimeTier ?? 'sdk',
		min_role: req.minRole ?? 'member',
		permission: req.permission ?? null,
		nats_prefix: req.natsPrefix ?? null,
		default_width: req.defaultWidth ?? 800,
		default_height: req.defaultHeight ?? 600,
		full_size_content: req.fullSizeContent ?? false,
		permissions_required: req.permissionsRequired ?? [],
		manifest_json: req.manifestJson ? JSON.stringify(req.manifestJson) : null,
		approval_status: req.approvalStatus ?? 'pending',
		current_version: req.version ?? '0.0.1',
	};
}

interface RegisterRequest {
	slug: string;
	name: string;
	path: string;
	repoUrl: string;
	authorName: string;
	authorUrl?: string;
	authorVerified?: boolean;
	iconUrl?: string;
	iconLucide?: string;
	shortDescription?: string;
	description?: string;
	screenshots?: string[];
	version?: string;
	license?: string;
	category?: string;
	tags?: string[];
	isOfficial?: boolean;
	isExperimental?: boolean;
	runtimeTier?: string;
	minRole?: string;
	permission?: string;
	natsPrefix?: string;
	defaultWidth?: number;
	defaultHeight?: number;
	fullSizeContent?: boolean;
	permissionsRequired?: string[];
	manifestJson?: Record<string, unknown>;
	approvalStatus?: string;
	installedBy?: string;
}

export const appHandlers: ServiceHandler[] = [
	// --- List installed apps (with store metadata) ---
	{
		subject: SUBJECTS.apps.list(),
		handler: async (msg) => {
			try {
				const rows = await sql()`
					SELECT i.id AS installed_id, i.slug, i.path, i.status,
						i.installed_at, i.installed_by, i.config,
						s.*
					FROM installed_apps i
					LEFT JOIN app_store s ON i.app_id = s.id
					WHERE i.status != 'uninstalled'
					ORDER BY s.name ASC NULLS LAST
				`;
				msg.respond(JSON.stringify({ apps: rows }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), apps: [] }));
			}
		},
	},

	// --- Get app store entry by slug ---
	{
		subject: SUBJECTS.apps.get(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ slug: string }>();
				if (!req.slug) {
					msg.respond(JSON.stringify({ error: 'slug is required' }));
					return;
				}
				const rows = await sql()`
					SELECT * FROM app_store WHERE slug = ${req.slug}
				`;
				if (rows.length === 0) {
					msg.respond(JSON.stringify({ error: 'App not found', app: null }));
					return;
				}
				msg.respond(JSON.stringify({ app: rows[0] }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), app: null }));
			}
		},
	},

	// --- Register app (upsert into app_store + insert into installed_apps) ---
	{
		subject: SUBJECTS.apps.register(),
		handler: async (msg) => {
			try {
				const req = msg.json<RegisterRequest>();
				if (!req.slug || !req.name || !req.path || !req.repoUrl || !req.authorName) {
					msg.respond(
						JSON.stringify({ ok: false, error: 'Missing required fields: slug, name, path, repoUrl, authorName' })
					);
					return;
				}

				const db = sql();
				const vals = storeDefaults(req);

				const storeRows = await db`
					INSERT INTO app_store ${db(vals)}
					ON CONFLICT (slug) DO UPDATE SET
						${db(
							vals,
							'name',
							'icon_url',
							'icon_lucide',
							'short_description',
							'description',
							'screenshots',
							'author_name',
							'author_url',
							'author_verified',
							'repo_url',
							'version',
							'license',
							'category',
							'tags',
							'is_official',
							'is_experimental',
							'runtime_tier',
							'min_role',
							'permission',
							'nats_prefix',
							'default_width',
							'default_height',
							'full_size_content',
							'permissions_required',
							'manifest_json',
							'current_version'
						)},
						updated_at = NOW()
					RETURNING id
				`;

				const appId = storeRows[0]?.id;

				await db`
					INSERT INTO installed_apps (app_id, slug, path, status, installed_by)
					VALUES (${appId}, ${req.slug}, ${req.path}, 'installed', ${req.installedBy ?? null})
					ON CONFLICT DO NOTHING
				`;

				msg.respond(JSON.stringify({ ok: true, appId }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Unregister app (remove from installed_apps, keep store entry) ---
	{
		subject: SUBJECTS.apps.unregister(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ slug: string }>();
				if (!req.slug) {
					msg.respond(JSON.stringify({ ok: false, error: 'slug is required' }));
					return;
				}

				const result = await sql()`
					DELETE FROM installed_apps WHERE slug = ${req.slug}
				`;

				msg.respond(JSON.stringify({ ok: true, deleted: result.count }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},
];
