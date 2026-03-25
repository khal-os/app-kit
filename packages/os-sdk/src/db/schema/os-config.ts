import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const osConfig = pgTable('os_config', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type OsConfigEntry = typeof osConfig.$inferSelect;
export type NewOsConfigEntry = typeof osConfig.$inferInsert;
