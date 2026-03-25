import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditEvents = pgTable('audit_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	entityType: text('entity_type').notNull(),
	entityId: text('entity_id').notNull(),
	eventType: text('event_type').notNull(),
	actorId: text('actor_id'),
	orgId: text('org_id'),
	details: jsonb('details'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
