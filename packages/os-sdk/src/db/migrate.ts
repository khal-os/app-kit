import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from '../config';

const HOST_MIGRATIONS_FOLDER = './drizzle';

/**
 * Bootstrap the Drizzle migration journal when tables already exist but the
 * journal doesn't. This handles installs where tables were created by raw SQL
 * before Drizzle was set up — without this, the migrator tries to re-run all
 * migrations and crashes on CREATE TYPE/TABLE that already exist.
 */
async function bootstrapJournalIfNeeded(client: postgres.Sql, migrationsFolder: string): Promise<void> {
	const journalPath = resolve(migrationsFolder, 'meta', '_journal.json');
	if (!existsSync(journalPath)) return;

	// Drizzle stores its journal in the "drizzle" schema, not "public"
	const DRIZZLE_SCHEMA = 'drizzle';
	const DRIZZLE_TABLE = '__drizzle_migrations';

	// If journal table already exists, Drizzle will handle state correctly
	const [{ exists: journalTableExists }] = await client`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = ${DRIZZLE_SCHEMA} AND table_name = ${DRIZZLE_TABLE}
		) as exists
	`;
	if (journalTableExists) return;

	// Journal table doesn't exist — check if any migrations were already applied
	// by looking for tables they create
	const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
	const alreadyApplied: Array<{ hash: string; when: number; tag: string }> = [];

	for (const entry of journal.entries) {
		const sqlPath = resolve(migrationsFolder, `${entry.tag}.sql`);
		if (!existsSync(sqlPath)) continue;

		const sqlContent = readFileSync(sqlPath, 'utf8');
		// Find the first CREATE TABLE in this migration to check if it was applied
		const match = sqlContent.match(/CREATE TABLE "(\w+)"/);
		if (!match) continue;

		const [{ exists: tableExists }] = await client`
			SELECT EXISTS (
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = ${match[1]}
			) as exists
		`;

		if (tableExists) {
			const hash = createHash('sha256').update(sqlContent).digest('hex');
			alreadyApplied.push({ hash, when: entry.when, tag: entry.tag });
		}
	}

	if (alreadyApplied.length > 0) {
		await client.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
		await client.unsafe(`
			CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`);
		for (const m of alreadyApplied) {
			await client`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${m.hash}, ${m.when})`;
		}
		// biome-ignore lint/suspicious/noConsole: migration logging
		console.log(
			`[db:migrate] bootstrapped journal with ${alreadyApplied.length} pre-existing migration(s): ${alreadyApplied.map((m) => m.tag).join(', ')}`
		);
	}
}

/**
 * Run host-only migrations from ./drizzle (backwards-compatible).
 */
export async function runMigrations(): Promise<void> {
	const url = getDatabaseUrl();

	// Drizzle migrator requires meta/_journal.json — skip if no migrations exist yet
	if (!existsSync(`${HOST_MIGRATIONS_FOLDER}/meta/_journal.json`)) {
		return;
	}

	const searchPath = process.env.KHAL_OS_SEARCH_PATH;
	const opts: Record<string, unknown> = { max: 1 };
	if (searchPath) {
		opts.connection = { search_path: searchPath };
	}
	const migrationClient = postgres(url, opts);
	const db = drizzle(migrationClient);

	try {
		await bootstrapJournalIfNeeded(migrationClient, HOST_MIGRATIONS_FOLDER);
		await migrate(db, { migrationsFolder: HOST_MIGRATIONS_FOLDER });
	} finally {
		await migrationClient.end();
	}
}

interface AppMigrationTarget {
	packageName: string;
	schemaName: string;
	migrationsFolder: string;
}

/**
 * Scan packages/* /drizzle/ for app migration folders.
 * Returns a list of migration targets with their schema names.
 */
function discoverAppMigrations(): AppMigrationTarget[] {
	const targets: AppMigrationTarget[] = [];
	const packagesDir = resolve(process.cwd(), 'packages');

	if (!existsSync(packagesDir)) return targets;

	const entries = readdirSync(packagesDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const pkgDir = resolve(packagesDir, entry.name);
		const journalPath = resolve(pkgDir, 'drizzle', 'meta', '_journal.json');

		// Skip packages without drizzle/meta/_journal.json
		if (!existsSync(journalPath)) continue;

		const pkgJsonPath = resolve(pkgDir, 'package.json');
		if (!existsSync(pkgJsonPath)) continue;

		try {
			const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
			const schemaName = pkg.genieOs?.schema?.schemaName;

			if (!schemaName) {
				// biome-ignore lint/suspicious/noConsole: migration logging
				console.warn(
					`[db:migrate] package ${entry.name} has drizzle/ but no genieOs.schema.schemaName in package.json — skipping`
				);
				continue;
			}

			targets.push({
				packageName: entry.name,
				schemaName,
				migrationsFolder: resolve(pkgDir, 'drizzle'),
			});
		} catch {
			// biome-ignore lint/suspicious/noConsole: migration logging
			console.warn(`[db:migrate] failed to read package.json for ${entry.name} — skipping`);
		}
	}

	return targets;
}

/**
 * Run migrations for a single app package with search_path isolation.
 */
async function runAppMigrations(target: AppMigrationTarget): Promise<void> {
	const url = getDatabaseUrl();
	const searchPath = `${target.schemaName},public`;

	const migrationClient = postgres(url, {
		max: 1,
		connection: { search_path: searchPath },
	});
	const db = drizzle(migrationClient);

	try {
		// biome-ignore lint/suspicious/noConsole: migration logging
		console.log(`[db:migrate] running migrations for ${target.packageName} (schema: ${target.schemaName})`);
		await bootstrapJournalIfNeeded(migrationClient, target.migrationsFolder);
		await migrate(db, { migrationsFolder: target.migrationsFolder });
		// biome-ignore lint/suspicious/noConsole: migration logging
		console.log(`[db:migrate] migrations complete for ${target.packageName}`);
	} finally {
		await migrationClient.end();
	}
}

/**
 * Run all migrations: host first, then per-app.
 * Each app's migrations run with search_path = <appSchema>,public.
 * Apps without drizzle/ are silently skipped.
 * Migration errors are fatal (not swallowed).
 */
export async function runAllMigrations(): Promise<void> {
	// 1. Host migrations (OS core tables)
	await runMigrations();

	// 2. Per-app migrations
	const appTargets = discoverAppMigrations();
	for (const target of appTargets) {
		await runAppMigrations(target);
	}
}

if ((import.meta as { main?: boolean }).main) {
	runAllMigrations()
		.then(() => process.exit(0))
		.catch((err) => {
			// biome-ignore lint/suspicious/noConsole: CLI entrypoint must log errors
			console.error('[db:migrate] failed:', err);
			process.exit(1);
		});
}
