import { getDb, initDb, isDbInitialized } from '@khal-os/sdk/db';
import { eq, like } from '@khal-os/sdk/db/operators';
import * as schema from '@khal-os/sdk/db/schema';
import type { NatsConnection } from '@khal-os/sdk/service';
import { createService } from '@khal-os/sdk/service';

const KEY_PREFIX = 'hello.flow.';

function getDatabaseUrl(): string {
	return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/khalos';
}

function db() {
	if (!isDbInitialized()) {
		initDb({ schema, getDatabaseUrl });
	}
	return getDb();
}

createService({
	name: 'hello-flow-designer',
	onReady: async (_nc: NatsConnection) => {
		console.log('[hello-flow-designer] Service ready, subscribed to hello.flows.*');
	},
	subscriptions: [
		{
			subject: 'hello.flows.save',
			handler: async (msg) => {
				try {
					const req = msg.json<{
						slug: string;
						name: string;
						description?: string;
						flow: unknown;
					}>();
					const key = `${KEY_PREFIX}${req.slug}`;
					const now = new Date().toISOString();

					const value = JSON.stringify({
						name: req.name,
						description: req.description || '',
						flow: req.flow,
						createdAt: now,
						updatedAt: now,
					});

					await db()
						.insert(schema.osConfig)
						.values({ key, value })
						.onConflictDoUpdate({
							target: schema.osConfig.key,
							set: {
								value: JSON.stringify({
									...JSON.parse(value),
									updatedAt: now,
								}),
							},
						});

					msg.respond(JSON.stringify({ ok: true, slug: req.slug }));
				} catch (err) {
					console.error('[hello-flow-designer] save error:', err);
					msg.respond(JSON.stringify({ ok: false, error: String(err) }));
				}
			},
		},
		{
			subject: 'hello.flows.load',
			handler: async (msg) => {
				try {
					const req = msg.json<{ slug: string }>();
					const key = `${KEY_PREFIX}${req.slug}`;

					const rows = await db().select().from(schema.osConfig).where(eq(schema.osConfig.key, key));

					if (rows.length === 0) {
						msg.respond(JSON.stringify({ ok: false, error: `Flow not found: ${req.slug}` }));
						return;
					}

					const data = JSON.parse(rows[0].value as string);
					msg.respond(
						JSON.stringify({
							ok: true,
							slug: req.slug,
							name: data.name,
							description: data.description,
							flow: data.flow,
						})
					);
				} catch (err) {
					console.error('[hello-flow-designer] load error:', err);
					msg.respond(JSON.stringify({ ok: false, error: String(err) }));
				}
			},
		},
		{
			subject: 'hello.flows.list',
			handler: async (msg) => {
				try {
					const rows = await db()
						.select()
						.from(schema.osConfig)
						.where(like(schema.osConfig.key, `${KEY_PREFIX}%`));

					const flows = rows.map((row) => {
						const data = JSON.parse(row.value as string);
						const slug = (row.key as string).replace(KEY_PREFIX, '');
						return {
							slug,
							name: data.name || slug,
							description: data.description || '',
							updatedAt: data.updatedAt || '',
						};
					});

					msg.respond(JSON.stringify({ ok: true, flows }));
				} catch (err) {
					console.error('[hello-flow-designer] list error:', err);
					msg.respond(JSON.stringify({ ok: false, flows: [], error: String(err) }));
				}
			},
		},
		{
			subject: 'hello.flows.delete',
			handler: async (msg) => {
				try {
					const req = msg.json<{ slug: string }>();
					const key = `${KEY_PREFIX}${req.slug}`;

					const deleted = await db().delete(schema.osConfig).where(eq(schema.osConfig.key, key)).returning();

					if (deleted.length === 0) {
						msg.respond(JSON.stringify({ ok: false, error: `Flow not found: ${req.slug}` }));
						return;
					}

					msg.respond(JSON.stringify({ ok: true }));
				} catch (err) {
					console.error('[hello-flow-designer] delete error:', err);
					msg.respond(JSON.stringify({ ok: false, error: String(err) }));
				}
			},
		},
		{
			subject: 'hello.flows.export',
			handler: async (msg) => {
				try {
					const req = msg.json<{ slug: string }>();
					const key = `${KEY_PREFIX}${req.slug}`;

					const rows = await db().select().from(schema.osConfig).where(eq(schema.osConfig.key, key));

					if (rows.length === 0) {
						msg.respond(JSON.stringify({ ok: false, error: `Flow not found: ${req.slug}` }));
						return;
					}

					const data = JSON.parse(rows[0].value as string);
					msg.respond(
						JSON.stringify({
							ok: true,
							json: JSON.stringify(data.flow, null, 2),
						})
					);
				} catch (err) {
					console.error('[hello-flow-designer] export error:', err);
					msg.respond(JSON.stringify({ ok: false, error: String(err) }));
				}
			},
		},
	],
});
