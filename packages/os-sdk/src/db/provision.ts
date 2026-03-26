/**
 * App schema provisioning — core OS capability.
 *
 * Each app calls provisionAppSchema() on boot to create its isolated
 * PostgreSQL schema + role via pgserve. Idempotent, safe for restarts.
 */

import pg from 'pg';
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

	const client = new pg.Client({ connectionString: getDatabaseUrl() });
	await client.connect();

	try {
		await initCatalog(client);
		const result = await provisionSchema(client, config);
		return { created: result.created };
	} finally {
		await client.end();
	}
}
