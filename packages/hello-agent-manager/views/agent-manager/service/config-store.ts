import type { ServiceHandler } from "@khal-os/sdk/service";
import { getDatabaseUrl } from "@khal-os/sdk/config";
import { getDb, initDb, isDbInitialized } from "@khal-os/sdk/db";
import { eq, sql } from "@khal-os/sdk/db/operators";
import * as schema from "@khal-os/sdk/db/schema";

function db() {
	if (!isDbInitialized()) {
		initDb({ schema, getDatabaseUrl });
	}
	return getDb();
}

export const configStoreHandlers: ServiceHandler[] = [
	{
		subject: "os.config.set",
		handler: async (msg) => {
			try {
				const req = msg.json<{ key: string; value: string }>();
				await db()
					.insert(schema.osConfig)
					.values({ key: req.key, value: req.value, updatedAt: new Date() })
					.onConflictDoUpdate({
						target: schema.osConfig.key,
						set: { value: req.value, updatedAt: new Date() },
					});
				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: "os.config.get",
		handler: async (msg) => {
			try {
				const req = msg.json<{ key: string }>();
				const [entry] = await db()
					.select()
					.from(schema.osConfig)
					.where(eq(schema.osConfig.key, req.key));
				msg.respond(
					JSON.stringify(
						entry
							? { key: entry.key, value: entry.value }
							: { key: req.key, value: null },
					),
				);
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: "os.config.list",
		handler: async (msg) => {
			try {
				const req = msg.json<{ prefix?: string }>();
				const prefix = req.prefix || "";
				const rows = await db()
					.select()
					.from(schema.osConfig)
					.where(sql`${schema.osConfig.key} LIKE ${`${prefix}%`}`);
				msg.respond(
					JSON.stringify({
						items: rows.map((r) => ({ key: r.key, value: r.value })),
					}),
				);
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: "os.config.delete",
		handler: async (msg) => {
			try {
				const req = msg.json<{ key: string }>();
				await db()
					.delete(schema.osConfig)
					.where(eq(schema.osConfig.key, req.key));
				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
];
