export type { ApiContext, ApiContextWithDb, ApiUser } from './api/handler';
export { apiHandler, apiHandlerWithDb } from './api/handler';
export type { SessionResult, SessionUser } from './api/session';
export { readSession } from './api/session';
export {
	AGENT_REPO_ROOT_ENV,
	AGENT_WORKTREE_ROOT_ENV,
	FILES_ROOT_ENV,
	getDatabaseUrl,
	NATS_URL,
} from './config';
export type { Database, DbConfig } from './db/factory';
export {
	assertDbInitialized,
	closeDb,
	getAppId,
	getDb,
	initDb,
	initDb as createDb,
	isDbInitialized,
} from './db/factory';
export { runAllMigrations, runMigrations } from './db/migrate';
// NATS instance isolation
export {
	extractInstanceId,
	INSTANCE_SUBJECT_PREFIX,
	instanceAuthConfig,
	instanceSubject,
	instanceWildcard,
	isInstanceScoped,
	stripInstancePrefix,
	validateInstanceAccess,
} from './lib/nats-isolation';
export { interceptConsole, restoreConsole } from './service/console-intercept';
// Fleet service
export type { CreateInstanceConfig, FleetService } from './service/fleet';
export { fleet } from './service/fleet';
export type { LogEntry, Logger } from './service/logger';
export { createLogger } from './service/logger';
export {
	ensureO11yStreams,
	O11Y_STREAM_EVENTS,
	O11Y_STREAM_LOGS,
	O11Y_STREAM_TRACES,
	O11Y_SUBJECT_EVENTS,
	O11Y_SUBJECT_LOGS,
	O11Y_SUBJECT_TRACES,
} from './service/o11y-streams';
export type { Msg, NatsConnection, ObserveConfig, ServiceConfig, ServiceHandler } from './service/runtime';
export { createEventPublisher, createService } from './service/runtime';
export type { TraceContext } from './service/trace';
export { extractTrace, injectTrace, newSpan, PARENT_SPAN_HEADER, SPAN_HEADER, TRACE_HEADER } from './service/trace';
