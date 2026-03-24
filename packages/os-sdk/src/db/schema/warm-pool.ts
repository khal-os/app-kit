import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const warmPoolStatusEnum = pgEnum('warm_pool_status', ['available', 'claimed', 'expired']);

export const warmPool = pgTable('warm_pool', {
	id: uuid('id').primaryKey().defaultRandom(),
	runtimeType: text('runtime_type').notNull(),
	imageId: text('image_id'),
	runtimeRef: text('runtime_ref').notNull(),
	status: warmPoolStatusEnum('status').notNull().default('available'),
	claimedBy: text('claimed_by'),
	claimedAt: timestamp('claimed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export type WarmPoolEntry = typeof warmPool.$inferSelect;
export type NewWarmPoolEntry = typeof warmPool.$inferInsert;
