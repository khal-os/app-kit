import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from '../config';

const HOST_MIGRATIONS_FOLDER = './drizzle';

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
