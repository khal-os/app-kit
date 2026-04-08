import { connect, type NatsConnection } from '@nats-io/transport-node';
import { WsBridgeClient } from './ws-nats-client.js';

const DEFAULT_NATS_PORT = 4222;

function isLocalhost(instanceUrl: string): boolean {
	try {
		const url = new URL(instanceUrl);
		return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
	} catch {
		return true;
	}
}

/**
 * Wrapper that adapts WsBridgeClient to a NatsConnection-like interface.
 * Only implements the methods the CLI actually uses: request, subscribe, close, publish.
 */
class WsBridgeNatsAdapter {
	constructor(private client: WsBridgeClient) {}

	async request(subject: string, data?: Uint8Array, opts?: { timeout?: number }) {
		const payload = data ? JSON.parse(new TextDecoder().decode(data)) : {};
		const result = await this.client.request(subject, payload, opts?.timeout);
		const encoded = new TextEncoder().encode(JSON.stringify(result));
		return { data: encoded };
	}

	subscribe(subject: string, _opts?: unknown) {
		const messages: Array<{ data: Uint8Array; subject: string }> = [];
		let resolve: (() => void) | null = null;

		const unsub = this.client.subscribe(subject, (data, subj) => {
			messages.push({
				data: new TextEncoder().encode(JSON.stringify(data)),
				subject: subj,
			});
			if (resolve) {
				resolve();
				resolve = null;
			}
		});

		const iterator = {
			[Symbol.asyncIterator]() {
				return {
					async next() {
						if (messages.length > 0) {
							return { value: messages.shift()!, done: false };
						}
						await new Promise<void>((r) => {
							resolve = r;
						});
						if (messages.length > 0) {
							return { value: messages.shift()!, done: false };
						}
						return { value: undefined, done: true };
					},
				};
			},
			unsubscribe() {
				unsub();
			},
		};

		return iterator;
	}

	publish(subject: string, data?: Uint8Array) {
		const payload = data ? JSON.parse(new TextDecoder().decode(data)) : undefined;
		this.client.publish(subject, payload);
	}

	async close() {
		await this.client.close();
	}
}

/**
 * Connect to a KhalOS instance's NATS server.
 *
 * - **localhost**: direct TCP connection via `@nats-io/transport-node`.
 * - **remote**: WebSocket connection via WS bridge at `/ws/nats`.
 */
export async function connectToInstance(instanceUrl: string, token?: string): Promise<NatsConnection> {
	if (isLocalhost(instanceUrl)) {
		const servers = process.env.NATS_URL || `nats://localhost:${DEFAULT_NATS_PORT}`;
		return connect({ servers });
	}

	// Remote instance — connect via WS bridge
	const client = new WsBridgeClient();
	await client.connect(instanceUrl, token);
	return new WsBridgeNatsAdapter(client) as unknown as NatsConnection;
}
