import { beforeEach, describe, expect, test } from 'bun:test';
import { BrowserNatsClient } from './nats-client-browser';
import { _resetNatsClientForTests, getNatsClient } from './nats-client-factory';

/**
 * Mock WebSocket capturing arguments and exposing open/close/message triggers.
 */
class MockWebSocket {
	static instances: MockWebSocket[] = [];
	url: string;
	protocols: string[];
	readyState = 0;
	protocol = '';
	sent: string[] = [];
	onopen: ((this: MockWebSocket, ev: Event) => unknown) | null = null;
	onmessage: ((ev: MessageEvent) => unknown) | null = null;
	onerror: ((ev: Event) => unknown) | null = null;
	onclose: ((ev: CloseEvent) => unknown) | null = null;

	constructor(url: string, protocols: string[]) {
		this.url = url;
		this.protocols = protocols;
		MockWebSocket.instances.push(this);
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(_code?: number, _reason?: string): void {
		this.readyState = 3;
	}

	// Harness helpers
	triggerOpen(serverProtocol: string): void {
		this.protocol = serverProtocol;
		this.readyState = 1;
		this.onopen?.(new Event('open'));
	}

	triggerMessage(data: unknown): void {
		this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent);
	}

	triggerClose(code: number, reason = ''): void {
		this.readyState = 3;
		this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent);
	}
}

function makeClient(token = 'tok-abc'): { client: BrowserNatsClient; ws: () => MockWebSocket } {
	MockWebSocket.instances = [];
	const client = new BrowserNatsClient(
		async () => ({ wsUrl: 'wss://k.example.com/ws/nats', token, version: '1.0.0' }),
		(url, protocols) => new MockWebSocket(url, protocols) as unknown as WebSocket
	);
	return { client, ws: () => MockWebSocket.instances[0] };
}

async function flushMicrotasks(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('BrowserNatsClient.connect', () => {
	test('opens WebSocket with khal.v1 + bearer subprotocols', async () => {
		const { ws } = makeClient('jwt-xyz');
		await flushMicrotasks();
		const socket = ws();
		expect(socket.url).toBe('wss://k.example.com/ws/nats');
		expect(socket.protocols).toEqual(['khal.v1', 'bearer.jwt-xyz']);
	});

	test('resolves to connected when server echoes khal.v1', async () => {
		const { client, ws } = makeClient();
		await flushMicrotasks();
		ws().triggerOpen('khal.v1');
		expect(client.connected).toBe(true);
		expect(client.connectionState).toBe('connected');
	});

	test('closes with version-mismatch when server echoes unknown protocol', async () => {
		const { client, ws } = makeClient();
		const states: Array<{ state: string; detail?: Record<string, unknown> }> = [];
		client.onConnectionStateChange((state, detail) => {
			states.push({ state, detail });
		});
		await flushMicrotasks();
		ws().triggerOpen('some-other-proto');
		expect(client.connected).toBe(false);
		const mismatch = states.find(
			(s) => (s.detail?.connectError as { kind?: string } | undefined)?.kind === 'version-mismatch'
		);
		expect(mismatch).toBeDefined();
	});
});

describe('BrowserNatsClient.subscribe/publish round-trip', () => {
	test('publishes a pub frame and delivers a matching msg frame to subscriber', async () => {
		const { client, ws } = makeClient();
		await flushMicrotasks();
		const socket = ws();
		socket.triggerOpen('khal.v1');

		const received: Array<{ subject: string; data: unknown }> = [];
		client.subscribe('foo.bar', (data, subject) => {
			received.push({ subject, data });
		});

		// First frame should be the `sub` the client pushed on subscribe.
		expect(JSON.parse(socket.sent[0])).toEqual({ op: 'sub', subject: 'foo.bar' });

		client.publish('foo.bar', { hello: 'world' });
		expect(JSON.parse(socket.sent[1])).toEqual({
			op: 'pub',
			subject: 'foo.bar',
			data: { hello: 'world' },
		});

		socket.triggerMessage({ subject: 'foo.bar', data: { echo: 1 } });
		expect(received).toEqual([{ subject: 'foo.bar', data: { echo: 1 } }]);
	});

	test('wildcard subscription matches nested subject', async () => {
		const { client, ws } = makeClient();
		await flushMicrotasks();
		const socket = ws();
		socket.triggerOpen('khal.v1');

		const received: string[] = [];
		client.subscribe('events.>', (_data, subject) => {
			received.push(subject);
		});
		socket.triggerMessage({ subject: 'events.user.login', data: {} });
		expect(received).toEqual(['events.user.login']);
	});
});

describe('BrowserNatsClient close-code → ConnectError mapping', () => {
	test.each([
		[4401, 'unauthenticated'],
		[4403, 'origin-rejected'],
		[4410, 'token-expired'],
		[4426, 'version-mismatch'],
		[1006, 'network-unreachable'],
	])('close %i maps to %s', async (code, expectedKind) => {
		const { client, ws } = makeClient();
		const states: Array<Record<string, unknown> | undefined> = [];
		client.onConnectionStateChange((_s, detail) => {
			states.push(detail);
		});
		await flushMicrotasks();
		ws().triggerOpen('khal.v1');
		ws().triggerClose(code, 'x');
		const mapped = states.map((d) => (d?.connectError as { kind?: string } | undefined)?.kind).filter(Boolean);
		expect(mapped).toContain(expectedKind);
	});
});

describe('BrowserNatsClient no-config guard', () => {
	test('emits no-config when reader returns null', async () => {
		const client = new BrowserNatsClient(async () => null);
		const states: Array<Record<string, unknown> | undefined> = [];
		client.onConnectionStateChange((_s, detail) => {
			states.push(detail);
		});
		await flushMicrotasks();
		const mapped = states.map((d) => (d?.connectError as { kind?: string } | undefined)?.kind).filter(Boolean);
		expect(mapped).toContain('no-config');
	});

	test('emits unauthenticated when reader returns config with empty token', async () => {
		const client = new BrowserNatsClient(async () => ({ wsUrl: 'wss://x/ws/nats', token: '' }));
		const states: Array<Record<string, unknown> | undefined> = [];
		client.onConnectionStateChange((_s, detail) => {
			states.push(detail);
		});
		await flushMicrotasks();
		const mapped = states.map((d) => (d?.connectError as { kind?: string } | undefined)?.kind).filter(Boolean);
		expect(mapped).toContain('unauthenticated');
	});
});

describe('getNatsClient factory', () => {
	beforeEach(() => {
		_resetNatsClientForTests();
		// Ensure browser path is taken (no __TAURI__)
		const globalWindow = (globalThis as { window?: Record<string, unknown> }).window;
		if (globalWindow) {
			delete globalWindow.__TAURI__;
		}
	});

	test('returns BrowserNatsClient when window.__TAURI__ is undefined', async () => {
		// Provide a minimal window with localStorage for the default reader path.
		(globalThis as { window?: unknown }).window = {
			localStorage: {
				length: 0,
				getItem: () => null,
				key: () => null,
			},
			__TAURI__: undefined,
		};
		const client = getNatsClient({ readBrowserConfig: async () => null });
		expect(client).toBeInstanceOf(BrowserNatsClient);
	});

	test('returns singleton across calls', () => {
		const a = getNatsClient({ readBrowserConfig: async () => null });
		const b = getNatsClient({ readBrowserConfig: async () => null });
		expect(a).toBe(b);
	});
});
