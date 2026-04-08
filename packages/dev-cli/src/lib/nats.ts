import type { NatsConnection } from '@nats-io/transport-node';
import { getCredentialForInstance, resolveInstance } from './config.js';
import { connectToInstance } from './connection.js';

/**
 * Connect to the NATS server for the resolved KhalOS instance.
 *
 * Resolution order: explicit `instanceUrl` param → `--instance` flag / `KHAL_INSTANCE` env / config.json → localhost.
 */
export async function connectNats(instanceUrl?: string): Promise<NatsConnection> {
	const instance = instanceUrl ?? resolveInstance();
	const cred = getCredentialForInstance(instance);
	return connectToInstance(instance, cred?.token);
}

/** Encode a value as JSON → UTF-8 bytes for NATS payloads. */
export function encode(data: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(data));
}

/** Decode NATS message data to a UTF-8 string. */
export function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

/** NATS request-reply helper. Connects, sends, parses response, disconnects. */
export async function natsRequest<T = Record<string, unknown>>(
	subject: string,
	payload: unknown = {},
	instanceUrl?: string,
	timeout = 5000
): Promise<T> {
	const nc = await connectNats(instanceUrl);
	try {
		const resp = await nc.request(subject, encode(payload), { timeout });
		return JSON.parse(decode(resp.data)) as T;
	} finally {
		await nc.close();
	}
}
