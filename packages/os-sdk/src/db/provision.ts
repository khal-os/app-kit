/**
 * App schema provisioning — core OS capability.
 *
 * Each app calls provisionAppSchema() on boot to create its isolated
 * PostgreSQL schema + role via pgserve. Idempotent, safe for restarts.
 *
 * Requires Bun runtime (uses Bun.SQL for the pgserve admin connection).
 */

import { getDatabaseUrl } from '../config';

export interface AppSchemaConfig {
	name: string;
	schemaName: string;
	roleName: string;
}

export async function provisionAppSchema(config: AppSchemaConfig): Promise<{ created: boolean }> {
	// pgserve is an optional runtime dependency — indirect import to skip tsc module resolution
	const pgserveModule = 'pgserve';
	// biome-ignore lint/suspicious/noExplicitAny: optional runtime dependency, no types guaranteed
	const { initCatalog, provisionSchema } = (await import(pgserveModule)) as any;
	// Bun.SQL is only available at runtime under Bun — indirect import to skip tsc module resolution
	const bunModule = 'bun';
	// biome-ignore lint/suspicious/noExplicitAny: Bun-only runtime API, no type declarations available
	const { SQL } = (await import(bunModule)) as any;

	const url = new URL(getDatabaseUrl());
	const adminSql = new SQL({
		hostname: url.hostname,
		port: Number(url.port),
		database: url.pathname.slice(1),
		username: url.username,
		password: url.password,
	});

	try {
		await initCatalog(adminSql);
		const result = await provisionSchema(adminSql, config);
		return { created: result.created };
	} finally {
		await adminSql.close();
	}
}
