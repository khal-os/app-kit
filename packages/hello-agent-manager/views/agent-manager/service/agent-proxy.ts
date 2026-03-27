import type { NatsConnection, ServiceHandler } from '@khal-os/sdk/service';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function forwardRequest(nc: NatsConnection, subject: string, data: unknown, timeoutMs = 5000): Promise<unknown> {
	const payload = encoder.encode(JSON.stringify(data));
	const response = await nc.request(subject, payload, {
		timeout: timeoutMs,
	});
	return JSON.parse(decoder.decode(response.data));
}

export const agentProxyHandlers: ServiceHandler[] = [
	{
		subject: 'os.hello.agents.list',
		handler: async (msg, nc) => {
			try {
				const result = await forwardRequest(nc, 'hello.agent.list', {});
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), agents: [] }));
			}
		},
	},
	{
		subject: 'os.hello.agents.get',
		handler: async (msg, nc) => {
			try {
				const req = msg.json<{ slug: string }>();
				const result = await forwardRequest(nc, 'hello.agent.config', { slug: req.slug });
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: 'os.hello.agents.create',
		handler: async (msg, nc) => {
			try {
				const req = msg.json<Record<string, unknown>>();
				if (!req.name || !req.slug) {
					msg.respond(JSON.stringify({ error: 'name and slug are required' }));
					return;
				}
				const result = await forwardRequest(nc, 'hello.agent.create', req);
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: 'os.hello.agents.update',
		handler: async (msg, nc) => {
			try {
				const req = msg.json<Record<string, unknown>>();
				const result = await forwardRequest(nc, 'hello.agent.create', req);
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: 'os.hello.agents.delete',
		handler: async (msg, nc) => {
			try {
				const req = msg.json<{ slug: string }>();
				const result = await forwardRequest(nc, 'hello.agent.delete', { slug: req.slug });
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: 'os.hello.agents.start',
		handler: async (msg, nc) => {
			try {
				const req = msg.json<{ slug: string }>();
				const result = await forwardRequest(nc, 'hello.agent.start', { slug: req.slug });
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: 'os.hello.agents.stop',
		handler: async (msg, nc) => {
			try {
				const req = msg.json<{ slug: string }>();
				const result = await forwardRequest(nc, 'hello.agent.stop', {
					slug: req.slug,
				});
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
	{
		subject: 'os.hello.agents.metrics',
		handler: async (msg, nc) => {
			try {
				const req = msg.json<{ slug?: string }>();
				const result = await forwardRequest(nc, 'hello.agent.metrics', req);
				msg.respond(JSON.stringify(result));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), metrics: [] }));
			}
		},
	},
];
