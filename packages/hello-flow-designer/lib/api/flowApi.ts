import type { FlowJson } from '../schema/flow.schema';
import { FLOW_SUBJECTS } from '../subjects';

type NatsClient = {
	request: (subject: string, data: unknown) => Promise<{ data: unknown }>;
};

let natsClient: NatsClient | null = null;

export function setFlowApiNatsClient(client: NatsClient) {
	natsClient = client;
}

function getNats(): NatsClient {
	if (!natsClient) {
		throw new Error('NATS client not initialized. Call setFlowApiNatsClient first.');
	}
	return natsClient;
}

export async function saveFlow(
	slug: string,
	name: string,
	description: string | undefined,
	flow: FlowJson
): Promise<{ ok: boolean; slug: string; error?: string }> {
	const nc = getNats();
	const res = await nc.request(FLOW_SUBJECTS.SAVE, { slug, name, description, flow });
	return res.data as { ok: boolean; slug: string; error?: string };
}

export async function loadFlow(
	slug: string
): Promise<{ ok: boolean; flow?: FlowJson; name?: string; slug?: string; error?: string }> {
	const nc = getNats();
	const res = await nc.request(FLOW_SUBJECTS.LOAD, { slug });
	return res.data as { ok: boolean; flow?: FlowJson; name?: string; slug?: string; error?: string };
}

export async function listFlows(): Promise<{
	ok: boolean;
	flows: Array<{ slug: string; name: string; description?: string; updatedAt: string }>;
}> {
	const nc = getNats();
	const res = await nc.request(FLOW_SUBJECTS.LIST, {});
	return res.data as {
		ok: boolean;
		flows: Array<{ slug: string; name: string; description?: string; updatedAt: string }>;
	};
}

export async function deleteFlow(slug: string): Promise<{ ok: boolean; error?: string }> {
	const nc = getNats();
	const res = await nc.request(FLOW_SUBJECTS.DELETE, { slug });
	return res.data as { ok: boolean; error?: string };
}
