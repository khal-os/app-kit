/**
 * Node.js NATS client that speaks the KhalOS WS bridge protocol.
 * Same JSON frame protocol as @khal-os/sdk NatsClient, but for Node.js.
 *
 * Protocol:
 *   Client → Server: { op: 'sub', subject } | { op: 'unsub', subject } | { op: 'pub', subject, data? } | { op: 'req', id, subject, data? }
 *   Server → Client: { subject, data } (msg) | { id, data } (reply) | { error, subject?, reason? } (error)
 */
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

type MessageCallback = (data: unknown, subject: string) => void;

interface PendingRequest {
	resolve: (data: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_REQUEST_TIMEOUT = 5000;

function subjectMatches(pattern: string, subject: string): boolean {
	if (pattern === subject) return true;
	const patParts = pattern.split('.');
	const subParts = subject.split('.');
	for (let i = 0; i < patParts.length; i++) {
		const p = patParts[i];
		if (p === '>') return i === patParts.length - 1 && subParts.length > i;
		if (i >= subParts.length) return false;
		if (p !== '*' && p !== subParts[i]) return false;
	}
	return patParts.length === subParts.length;
}

export class WsBridgeClient {
	private ws: WebSocket | null = null;
	private subscribers = new Map<string, Set<MessageCallback>>();
	private pendingRequests = new Map<string, PendingRequest>();
	private _connected = false;
	private connectPromise: Promise<void> | null = null;

	get connected(): boolean {
		return this._connected;
	}

	/**
	 * Connect to a KhalOS WS bridge.
	 * @param instanceUrl — e.g. "https://hv.khal.ai"
	 * @param token — API key or session token for Authorization header
	 */
	async connect(instanceUrl: string, token?: string): Promise<void> {
		if (this._connected && this.ws) return;
		if (this.connectPromise) return this.connectPromise;

		this.connectPromise = new Promise<void>((resolve, reject) => {
			const wsProtocol = instanceUrl.startsWith('https') ? 'wss:' : 'ws:';
			const host = instanceUrl.replace(/^https?:\/\//, '');
			const wsUrl = `${wsProtocol}//${host}/ws/nats`;

			const headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}

			const ws = new WebSocket(wsUrl, { headers });
			this.ws = ws;

			ws.on('open', () => {
				this._connected = true;
				// Re-subscribe all active subjects
				for (const subject of this.subscribers.keys()) {
					this.sendFrame({ op: 'sub', subject });
				}
				resolve();
			});

			ws.on('message', (raw: Buffer | string) => {
				this.handleMessage(typeof raw === 'string' ? raw : raw.toString());
			});

			ws.on('close', () => {
				this._connected = false;
				this.ws = null;
				this.connectPromise = null;
				// Reject all pending requests
				for (const [id, pending] of this.pendingRequests) {
					clearTimeout(pending.timer);
					pending.reject(new Error('connection closed'));
					this.pendingRequests.delete(id);
				}
			});

			ws.on('error', (err) => {
				if (!this._connected) {
					reject(err);
				}
			});
		});

		return this.connectPromise;
	}

	subscribe(subject: string, callback: MessageCallback): () => void {
		let callbacks = this.subscribers.get(subject);
		if (!callbacks) {
			callbacks = new Set();
			this.subscribers.set(subject, callbacks);
			this.sendFrame({ op: 'sub', subject });
		}
		callbacks.add(callback);

		return () => {
			const cbs = this.subscribers.get(subject);
			if (!cbs) return;
			cbs.delete(callback);
			if (cbs.size === 0) {
				this.subscribers.delete(subject);
				this.sendFrame({ op: 'unsub', subject });
			}
		};
	}

	publish(subject: string, data?: unknown): void {
		this.sendFrame({ op: 'pub', subject, data });
	}

	request(subject: string, data?: unknown, timeoutMs?: number): Promise<unknown> {
		const id = randomUUID();
		const timeout = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT;

		return new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`request to "${subject}" timed out after ${timeout}ms`));
			}, timeout);

			this.pendingRequests.set(id, { resolve, reject, timer });
			this.sendFrame({ op: 'req', id, subject, data });
		});
	}

	async close(): Promise<void> {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this._connected = false;
	}

	private handleMessage(raw: string): void {
		let frame: Record<string, unknown>;
		try {
			frame = JSON.parse(raw);
		} catch {
			return;
		}

		if ('error' in frame) {
			// Error frame — log silently
			return;
		}
		if ('id' in frame && typeof frame.id === 'string') {
			// Reply frame
			const pending = this.pendingRequests.get(frame.id);
			if (pending) {
				clearTimeout(pending.timer);
				this.pendingRequests.delete(frame.id);
				pending.resolve(frame.data);
			}
			return;
		}
		if ('subject' in frame && typeof frame.subject === 'string') {
			// Message frame
			for (const [pattern, callbacks] of this.subscribers) {
				if (!subjectMatches(pattern, frame.subject)) continue;
				for (const cb of callbacks) {
					try {
						cb(frame.data, frame.subject);
					} catch {
						// Ignore callback errors
					}
				}
			}
		}
	}

	private sendFrame(frame: Record<string, unknown>): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(frame));
		}
	}
}
