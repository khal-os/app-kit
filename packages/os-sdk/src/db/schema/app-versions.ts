import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { appStore } from './app-store';

export const appVersions = pgTable('app_versions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	appId: text('app_id')
		.references(() => appStore.id, { onDelete: 'cascade' })
		.notNull(),
	version: text('version').notNull(),
	gitBranch: text('git_branch'),
	gitCommit: text('git_commit'),
	changelog: text('changelog'),
	manifestJson: jsonb('manifest_json'),
	publishedBy: text('published_by'),
	publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AppVersion = typeof appVersions.$inferSelect;
export type NewAppVersion = typeof appVersions.$inferInsert;
