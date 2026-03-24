/**
 * OS Config — source of truth for all environment variables.
 *
 * All values are resolved eagerly at module import time.
 * Required variables that are missing will throw immediately (fail-fast).
 *
 * Server-side exports: NATS_URL, getDatabaseUrl()
 * Path config exports (server-only, no default applied): FILES_ROOT_ENV, AGENT_REPO_ROOT_ENV, AGENT_WORKTREE_ROOT_ENV
 * getDatabaseUrl() is lazy (not resolved at import) so client components can safely
 * import this module without triggering a browser crash.
 */

/**
 * URL of the NATS server.
 *
 * Resolution order: NATS_URL → 'nats://localhost:4222'
 * Never throws — falls back to localhost.
 */
export const NATS_URL: string = process.env.NATS_URL ?? 'nats://localhost:4222';

/**
 * PostgreSQL connection string.
 *
 * Lazy — resolved on first access, not at import time.
 * This allows client components to safely import this module without triggering
 * a DATABASE_URL crash in the browser.
 *
 * Throws if accessed from the browser or if DATABASE_URL is not set.
 */
let _databaseUrl: string | undefined;

export function getDatabaseUrl(): string {
	if (typeof window !== 'undefined') {
		throw new Error('[config] DATABASE_URL must not be accessed from the browser.');
	}
	if (_databaseUrl === undefined) {
		const url = process.env.DATABASE_URL;
		if (!url) {
			throw new Error('[config] DATABASE_URL is required but not set. Set it in your .env file.');
		}
		_databaseUrl = url;
	}
	return _databaseUrl;
}

/**
 * Raw env var for the files root directory.
 * Use getFilesRoot() from @/lib/files/safe-path which applies the ~/khal-os-files default.
 *
 * Server-only path config — safe to read (just a string), but the default requires node:os.
 */
export const FILES_ROOT_ENV: string | undefined = process.env.OS_FILES_ROOT;

/**
 * Raw env var for the agent git repository root directory.
 * Use getAgentRepoRoot() from @/lib/git/agent-repo which applies the default.
 *
 * Server-only path config.
 */
export const AGENT_REPO_ROOT_ENV: string | undefined = process.env.OS_AGENT_REPO_ROOT;

/**
 * Raw env var for the agent git worktree root directory.
 * Use createWorktreeManager() from @/lib/git/worktree which applies the default.
 *
 * Server-only path config.
 */
export const AGENT_WORKTREE_ROOT_ENV: string | undefined = process.env.OS_AGENT_WORKTREE_ROOT;
