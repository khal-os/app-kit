import { jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { appStore } from './app-store';

export const installedAppStatusEnum = pgEnum('installed_app_status', ['installed', 'running', 'stopped', 'error']);

export const installedApps = pgTable('installed_apps', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	appId: text('app_id').references(() => appStore.id),
	slug: text('slug').unique().notNull(),
	path: text('path').notNull(),
	status: installedAppStatusEnum('status').notNull().default('installed'),
	installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
	installedBy: text('installed_by'),
	config: jsonb('config'),
});

export type InstalledApp = typeof installedApps.$inferSelect;
export type NewInstalledApp = typeof installedApps.$inferInsert;
