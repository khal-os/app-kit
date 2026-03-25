import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);

export const itemTypeEnum = pgEnum('item_type', [
	'app',
	'workflow',
	'skill',
	'template',
	'stack',
	'agent',
	'board',
	'hook',
]);

export const appStore = pgTable('app_store', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	slug: text('slug').unique().notNull(),
	name: text('name').notNull(),
	itemType: itemTypeEnum('item_type').notNull().default('app'),
	iconUrl: text('icon_url'),
	iconLucide: text('icon_lucide'),
	shortDescription: text('short_description'),
	description: text('description'),
	screenshots: text('screenshots').array(),
	videoUrl: text('video_url'),
	bannerUrl: text('banner_url'),
	authorName: text('author_name'),
	authorUrl: text('author_url'),
	authorVerified: boolean('author_verified').default(false),
	repoUrl: text('repo_url').notNull(),
	version: text('version'),
	license: text('license'),
	category: text('category'),
	tags: text('tags').array(),
	isOfficial: boolean('is_official').default(false),
	isExperimental: boolean('is_experimental').default(false),
	downloadCount: integer('download_count').default(0),
	approvalStatus: approvalStatusEnum('approval_status').notNull().default('pending'),
	approvedBy: text('approved_by'),
	approvedAt: timestamp('approved_at', { withTimezone: true }),
	submittedBy: text('submitted_by'),
	submittedAt: timestamp('submitted_at', { withTimezone: true }),
	rejectionReason: text('rejection_reason'),
	runtimeTier: text('runtime_tier'),
	minRole: text('min_role'),
	permission: text('permission'),
	natsPrefix: text('nats_prefix'),
	defaultWidth: integer('default_width'),
	defaultHeight: integer('default_height'),
	fullSizeContent: boolean('full_size_content').default(false),
	permissionsRequired: text('permissions_required').array(),
	contents: jsonb('contents'),
	agentConfig: jsonb('agent_config'),
	ideaId: text('idea_id'),
	manifestJson: jsonb('manifest_json'),
	currentVersion: text('current_version'),
	gitBranch: text('git_branch'),
	gitCommit: text('git_commit'),
	changelog: text('changelog'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AppStoreEntry = typeof appStore.$inferSelect;
export type NewAppStoreEntry = typeof appStore.$inferInsert;
