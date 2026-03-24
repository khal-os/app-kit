import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const instanceStatusEnum = pgEnum('instance_status', ['creating', 'running', 'stopped', 'suspended', 'error']);

export const instances = pgTable('instances', {
	id: uuid('id').primaryKey().defaultRandom(),
	orgId: text('org_id').notNull(),
	name: text('name').notNull(),
	runtimeType: text('runtime_type').notNull(),
	runtimeConfig: jsonb('runtime_config'),
	status: instanceStatusEnum('status').notNull().default('creating'),
	url: text('url'),
	snapshotId: text('snapshot_id'),
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Instance = typeof instances.$inferSelect;
export type NewInstance = typeof instances.$inferInsert;
