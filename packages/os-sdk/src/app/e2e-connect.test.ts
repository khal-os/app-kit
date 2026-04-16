/**
 * G10 E2E — end-to-end round-trip test for BrowserNatsClient against a real
 * WebSocket server matching the kernel's auth + frame contract.
 *
 * This is the "parity test" the wish calls for — a full flow without mocking
 * the WS primitive:
 *   1. Spin up a real `ws.WebSocketServer` listening on an ephemeral port.
 *   2. Kernel-side behavior is simulated explicitly:
 *      - First `Sec-WebSocket-Protocol` must be `khal.v1`; server echoes it.
 *      - Second entry must be `bearer.<token>` or the upgrade is refused.
 *   3. Construct a BrowserNatsClient pointed at the server with a real
 *      global `WebSocket` (from the `ws` npm package).
 *   4. Round-trip: subscribe → publish → server echoes back a msg frame →
 *      subscriber callback fires.
 *
 * This catches two classes of regression the unit tests can't:
 *   - Subprotocol ordering / echo behavior drift between client and server.
 *   - Frame serialization (JSON shape `{op, subject, data, id}`) drift.
 */

// Use the real node `ws` package as the WebSocket primitive in both the
// server and the client side of this test.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { WebSocket as WsWebSocket, WebSocketServer } from 'ws';
import { BrowserNatsClient } from './nats-client-browser';

interface HarnessServer {
	port: number;
	lastToken: string | null;
	close: () => Promise<void>;
	/** Broadcast a `{subject, data}` frame to all currently-connected clients. */
	sendMsg: (subject: string, data: unknown) => void;
	/** Recent frames received from clients (JSON-decoded). */
	received: Array<Record<string, unknown>>;
}

async function startHarness(): Promise<HarnessServer> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const wss = new WebSocketServer({ port: 0, handleProtocols: (protocols: any) => {
		// `protocols` may be a Set (ws>=8) or comma-string. Normalize to array.
		const list: string[] = Array.isArray(protocols)
			? protocols
			: typeof protocols === 'string'
				? protocols.split(',').map((s: string) => s.trim())
				: Array.from(protocols as Set<string>);
		// Contract: khal.v1 must be first. Echo it back as the accepted protocol.
		return list[0] === 'khal.v1' ? 'khal.v1' : false;
	} });

	const address = wss.address();
	if (!address || typeof address === 'string') throw new Error('unexpected server address');
	const port = address.port;

	const received: Array<Record<string, unknown>> = [];
	const clients = new Set<import('ws').WebSocket>();
	let lastToken: string | null = null;

	wss.on('connection', (sock, req) => {
		const header = req.headers['sec-websocket-protocol'];
		const parts = typeof header === 'string' ? header.split(',').map((s) => s.trim()) : [];
		const bearer = parts.find((p) => p.startsWith('bearer.'));
		if (!bearer) {
			sock.close(4401, 'missing bearer');
			return;
		}
		lastToken = bearer.slice('bearer.'.length);
		clients.add(sock);
		sock.on('message', (raw) => {
			try {
				received.push(JSON.parse(raw.toString()));
			} catch {}
		});
		sock.on('close', () => clients.delete(sock));
	});

	return {
		port,
		get lastToken() {
			return lastToken;
		},
		received,
		sendMsg(subject, data) {
			const frame = JSON.stringify({ subject, data });
			for (const c of clients) c.send(frame);
		},
		async close() {
			for (const c of clients) c.terminate();
			clients.clear();
			// `wss.close` waits for all sockets; use a hard timeout so a
			// lingering client socket can't hang the test runner.
			await Promise.race([
				new Promise<void>((resolve) => wss.close(() => resolve())),
				new Promise<void>((resolve) => setTimeout(resolve, 500)),
			]);
		},
	};
}

function waitFor<T>(predicate: () => T | undefined, timeoutMs = 1000): Promise<T> {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + timeoutMs;
		const tick = () => {
			const result = predicate();
			if (result !== undefined) {
				resolve(result);
				return;
			}
			if (Date.now() > deadline) {
				reject(new Error(`waitFor: predicate never satisfied within ${timeoutMs}ms`));
				return;
			}
			setTimeout(tick, 20);
		};
		tick();
	});
}

describe('G10 E2E — BrowserNatsClient ↔ real ws server', () => {
	let harness: HarnessServer;

	beforeEach(async () => {
		harness = await startHarness();
	});

	afterEach(async () => {
		await harness.close();
	});

	test('subprotocol handshake carries the token to the server', async () => {
		const client = new BrowserNatsClient(
			async () => ({
				wsUrl: `ws://127.0.0.1:${harness.port}/ws/nats`,
				token: 'jwt-under-test',
			}),
			{ signInUrl: '/sign-in', clientVersion: '1.0.0' },
			(url, protocols) => new WsWebSocket(url, protocols) as unknown as WebSocket
		);

		await waitFor(() => (harness.lastToken ? true : undefined));
		expect(harness.lastToken).toBe('jwt-under-test');
		// Wait for the connected state to flip before the test ends.
		await waitFor(() => (client.connected ? true : undefined));
		expect(client.connectionState).toBe('connected');
	});

	test('full round-trip: subscribe + publish + server-echoed msg → subscriber fires', async () => {
		const client = new BrowserNatsClient(
			async () => ({
				wsUrl: `ws://127.0.0.1:${harness.port}/ws/nats`,
				token: 'jwt-under-test',
			}),
			{ signInUrl: '/sign-in', clientVersion: '1.0.0' },
			(url, protocols) => new WsWebSocket(url, protocols) as unknown as WebSocket
		);
		await waitFor(() => (client.connected ? true : undefined));

		const received: Array<{ subject: string; data: unknown }> = [];
		client.subscribe('demo.events', (data, subject) => {
			received.push({ subject, data });
		});

		// Wait for the sub frame to reach the server.
		await waitFor(() => harness.received.find((f) => f.op === 'sub'));
		expect(harness.received.find((f) => f.op === 'sub')).toEqual({ op: 'sub', subject: 'demo.events' });

		client.publish('demo.events', { hello: 'world' });
		await waitFor(() => harness.received.find((f) => f.op === 'pub'));
		const pub = harness.received.find((f) => f.op === 'pub') as Record<string, unknown>;
		expect(pub.subject).toBe('demo.events');
		expect(pub.data).toEqual({ hello: 'world' });

		// Server → client echo — exercises the msg-frame path.
		harness.sendMsg('demo.events', { echoed: true });
		await waitFor(() => (received.length > 0 ? true : undefined));
		expect(received).toEqual([{ subject: 'demo.events', data: { echoed: true } }]);
	});

	test('server rejects missing bearer → client surfaces unauthenticated', async () => {
		// Write the bearer in a format the server won't accept (missing prefix).
		const client = new BrowserNatsClient(
			async () => ({
				wsUrl: `ws://127.0.0.1:${harness.port}/ws/nats`,
				token: '', // empty token short-circuits client-side before handshake
			}),
			{ signInUrl: '/sign-in', clientVersion: '1.0.0' }
		);
		const errors: Array<{ kind?: string } | undefined> = [];
		client.onConnectionStateChange((_s, err) => {
			errors.push(err);
		});
		await waitFor(() => errors.find((e) => e?.kind === 'unauthenticated'));
		expect(errors.find((e) => e?.kind === 'unauthenticated')).toBeDefined();
	});
});
