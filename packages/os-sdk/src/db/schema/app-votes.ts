import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { appStore } from './app-store';

export const appVotes = pgTable(
	'app_votes',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id').notNull(),
		appId: text('app_id')
			.notNull()
			.references(() => appStore.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [unique('app_votes_user_app_unique').on(t.userId, t.appId)]
);

export type AppVote = typeof appVotes.$inferSelect;
export type NewAppVote = typeof appVotes.$inferInsert;
