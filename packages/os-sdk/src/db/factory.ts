import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export interface DbConfig {
	schema: Record<string, unknown>;
	getDatabaseUrl: () => string;
	appId?: string;
	searchPath?: string; // e.g. 'myapp,public'
}

let _config: DbConfig | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Register database configuration during host bootstrap.
 * Connection remains lazy and is opened on first getDb() call.
 */
export function initDb(config: DbConfig): void {
	if (_config) return;
	_config = config;
}

export function isDbInitialized(): boolean {
	return _config !== null;
}

export function assertDbInitialized(): void {
	if (!_config) {
		throw new Error('[os-sdk] Database not initialized. Call initDb() during host bootstrap.');
	}
}

/**
 * Return the appId that was passed to initDb(), if any.
 */
export function getAppId(): string | undefined {
	return _config?.appId;
}

/**
 * Return the Drizzle DB instance, creating the connection on first call.
 * Throws if initDb() has not been called yet.
 */
export function getDb() {
	assertDbInitialized();
	const config = _config;
	if (!config) {
		throw new Error('[os-sdk] Database not initialized. Call initDb() during host bootstrap.');
	}
	if (!_db) {
		const url = config.getDatabaseUrl();
		const opts: Record<string, unknown> = { max: 10, idle_timeout: 20, connect_timeout: 10 };
		if (config.searchPath) {
			opts.connection = { search_path: config.searchPath };
		}
		_client = postgres(url, opts);
		_db = drizzle(_client, { schema: config.schema });
	}
	return _db;
}

export type Database = ReturnType<typeof getDb>;

export async function closeDb(): Promise<void> {
	if (_client) {
		await _client.end();
	}
	_client = null;
	_db = null;
	_config = null;
}
