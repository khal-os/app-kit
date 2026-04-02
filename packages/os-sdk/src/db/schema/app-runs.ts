import { integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { appStore } from './app-store';

export const runTriggerEnum = pgEnum('run_trigger', ['manual', 'scheduled', 'agent', 'automation']);
export const runStatusEnum = pgEnum('run_status', ['running', 'success', 'failure', 'error', 'timeout']);

export const appRuns = pgTable('app_runs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	appId: text('app_id')
		.notNull()
		.references(() => appStore.id),
	appVersion: text('app_version'),
	userId: text('user_id'),
	agentId: text('agent_id'),
	automationId: text('automation_id'),
	trigger: runTriggerEnum('trigger').notNull().default('manual'),
	startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
	endedAt: timestamp('ended_at', { withTimezone: true }),
	durationMs: integer('duration_ms'),
	status: runStatusEnum('status').notNull().default('running'),
	costTokens: integer('cost_tokens'),
	costComputeMs: integer('cost_compute_ms'),
	costApiCalls: integer('cost_api_calls'),
	outputSummary: text('output_summary'),
	agentTrace: jsonb('agent_trace'),
	metadata: jsonb('metadata'),
});

export type AppRun = typeof appRuns.$inferSelect;
export type NewAppRun = typeof appRuns.$inferInsert;
