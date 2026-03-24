import { bigint, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const goldenImageStatusEnum = pgEnum('golden_image_status', ['building', 'ready', 'expired']);

export const goldenImages = pgTable('golden_images', {
	id: uuid('id').primaryKey().defaultRandom(),
	runtimeType: text('runtime_type').notNull(),
	version: text('version').notNull(),
	imageRef: text('image_ref').notNull(),
	sizeBytes: bigint('size_bytes', { mode: 'number' }),
	status: goldenImageStatusEnum('status').notNull().default('building'),
	builtAt: timestamp('built_at', { withTimezone: true }),
	expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export type GoldenImage = typeof goldenImages.$inferSelect;
export type NewGoldenImage = typeof goldenImages.$inferInsert;
