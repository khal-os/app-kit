'use client';

import type { ConnectionState } from '@khal-os/types';
import {
	type ConnectErrorPlaceholder,
	type NatsClientTransport,
	type NatsConnectionStateListener,
	type NatsMessageCallback,
	type NatsStatusCallback,
	subjectMatches,
} from './nats-client-transport';

interface PendingRequest {
	resolve: (data: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * Browser enterprise config — read from the browser adapter's localStorage
 * via `readEnterpriseConfig`. Injected via the constructor so this class
 * stays free of desktop-repo dependencies.
 */
export interface BrowserEnterpriseConfig {
	wsUrl: string;
	token: string;
	version?: string;
}

/** Reader contract — lets the caller inject the browser adapter. */
export type BrowserConfigReader = () => Promise<BrowserEnterpriseConfig | null>;

const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const WS_SUBPROTOCOL_VERSION = 'khal.v1';

// WS close-code mapping from the kernel (see repos/core/src/lib/platform-jwt.ts
// `rejectToCloseCode`): 4401 unauth, 4403 forbidden, 4410 token expired.
// 4426 is the kernel's close code for version mismatch (Upgrade Required).
function closeCodeToConnectError(code: number, reason?: string): ConnectErrorPlaceholder {
	if (code === 4410) return { kind: 'token-expired' };
	if (code === 4403) return { kind: 'origin-rejected' };
	if (code === 4401) return { kind: 'unauthenticated' };
	if (code === 4426) return { kind: 'version-mismatch' };
	return { kind: 'network-unreachable', detail: reason ?? `close_code_${code}` };
}

/**
 * Browser NATS client.
 *
 * Opens a direct WebSocket to the kernel's `/ws/nats` endpoint using the
 * `Sec-WebSocket-Protocol: khal.v1, bearer.<jwt>` subprotocol auth (browsers
 * cannot set custom Authorization headers on WS upgrades). The server echoes
 * `khal.v1` as the first protocol on successful handshake; a missing echo
 * surfaces as a `version-mismatch` ConnectError.
 *
 * Frame format matches the Rust relay: JSON `{op, subject, data?, id?}`.
 *
 * TODO(G4): replace the placeholder error union with the shared `ConnectError`
 * taxonomy and unify state machine handling across Tauri + browser.
 */
export class BrowserNatsClient implements NatsClientTransport {
	private _connected = false;
	private subscribers = new Map<string, Set<NatsMessageCallback>>();
	private pendingRequests = new Map<string, PendingRequest>();
	private statusListeners = new Set<NatsStatusCallback>();
	private _orgId = '';
	private _userId = '';
	private _connectionState: ConnectionState = 'disconnected';
	private _stateListeners: Array<NatsConnectionStateListener> = [];
	private ws: WebSocket | null = null;
	private readonly readConfig: BrowserConfigReader;
	private readonly wsFactory: (url: string, protocols: string[]) => WebSocket;

	/**
	 * @param readConfig  reader that returns the current browser enterprise config
	 * @param wsFactory   optional WebSocket constructor injection (defaults to global `WebSocket`) — used for tests
	 */
	constructor(readConfig: BrowserConfigReader, wsFactory?: (url: string, protocols: string[]) => WebSocket) {
		this.readConfig = readConfig;
		this.wsFactory =
			wsFactory ??
			((url, protocols) => {
				if (typeof WebSocket === 'undefined') {
					throw new Error('[nats-client-browser] global WebSocket is not available in this environment');
				}
				return new WebSocket(url, protocols);
			});
		this.connect();
	}

	// --- Public API ---

	get connected(): boolean {
		return this._connected;
	}

	get orgId(): string {
		return this._orgId;
	}

	get userId(): string {
		return this._userId;
	}

	get connectionState(): ConnectionState {
		return this._connectionState;
	}

	setOrgId(orgId: string): void {
		this._orgId = orgId;
	}

	setUserId(userId: string): void {
		this._userId = userId;
	}

	onStatusChange(callback: NatsStatusCallback): () => void {
		this.statusListeners.add(callback);
		return () => {
			this.statusListeners.delete(callback);
		};
	}

	onConnectionStateChange(listener: NatsConnectionStateListener): () => void {
		this._stateListeners.push(listener);
		return () => {
			this._stateListeners = this._stateListeners.filter((l) => l !== listener);
		};
	}

	subscribe(subject: string, callback: NatsMessageCallback): () => void {
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
		const id = crypto.randomUUID();
		const timeout = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

		return new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`request to "${subject}" timed out after ${timeout}ms`));
			}, timeout);

			this.pendingRequests.set(id, { resolve, reject, timer });
			this.sendFrame({ op: 'req', id, subject, data });
		});
	}

	// --- Connection management ---

	private async connect(): Promise<void> {
		try {
			const config = await this.readConfig();
			if (!config) {
				this.emitConnectError({ kind: 'no-config' });
				return;
			}
			if (!config.token) {
				this.emitConnectError({ kind: 'unauthenticated' });
				return;
			}

			const protocols = [WS_SUBPROTOCOL_VERSION, `bearer.${config.token}`];
			const ws = this.wsFactory(config.wsUrl, protocols);
			this.ws = ws;

			ws.onopen = () => {
				// Server MUST echo our version as the first accepted protocol.
				// A bare WS lib picks the first offered protocol; mismatch → version-mismatch.
				if (ws.protocol && ws.protocol !== WS_SUBPROTOCOL_VERSION) {
					this.emitConnectError({ kind: 'version-mismatch', required: WS_SUBPROTOCOL_VERSION });
					ws.close(4426, 'subprotocol mismatch');
					return;
				}
				this.setConnected(true);
				this.setConnectionState('connected');
				// Re-subscribe known subjects (no-op on first connect).
				for (const subject of this.subscribers.keys()) {
					this.sendFrame({ op: 'sub', subject });
				}
			};

			ws.onmessage = (ev: MessageEvent) => {
				if (typeof ev.data !== 'string') return;
				this.handleMessage(ev.data);
			};

			ws.onerror = () => {
				// Browser WebSocket never exposes error details for security reasons.
				// The subsequent `onclose` carries the code we can act on.
			};

			ws.onclose = (ev: CloseEvent) => {
				this.setConnected(false);
				const err = closeCodeToConnectError(ev.code, ev.reason);
				this.emitConnectError(err);
			};
		} catch (err) {
			const detail = err instanceof Error ? err.message : String(err);
			this.emitConnectError({ kind: 'network-unreachable', detail });
		}
	}

	private handleMessage(raw: string): void {
		let frame: Record<string, unknown>;
		try {
			frame = JSON.parse(raw);
		} catch {
			return;
		}

		if ('error' in frame) {
			this.handleErrorFrame(frame);
		} else if ('id' in frame && typeof frame.id === 'string') {
			this.handleReplyFrame(frame.id, frame.data);
		} else if ('subject' in frame && typeof frame.subject === 'string') {
			this.handleMsgFrame(frame.subject, frame.data);
		}
	}

	private handleErrorFrame(frame: Record<string, unknown>): void {
		const reason = typeof frame.reason === 'string' ? frame.reason : undefined;
		const subject = typeof frame.subject === 'string' ? frame.subject : undefined;

		if (reason && subject) {
			// biome-ignore lint/suspicious/noConsole: client-side debug logging for NATS errors
			console.warn(`[nats-client-browser] ${reason}: ${subject} — ${frame.error}`);
		} else if (reason) {
			// biome-ignore lint/suspicious/noConsole: client-side debug logging for NATS errors
			console.warn(`[nats-client-browser] ${reason}: ${frame.error}`);
		} else {
			// biome-ignore lint/suspicious/noConsole: client-side debug logging for NATS errors
			console.warn('[nats-client-browser] server error:', frame.error);
		}
	}

	private handleReplyFrame(id: string, data: unknown): void {
		const pending = this.pendingRequests.get(id);
		if (!pending) return;
		clearTimeout(pending.timer);
		this.pendingRequests.delete(id);
		pending.resolve(data);
	}

	private handleMsgFrame(subject: string, data: unknown): void {
		for (const [pattern, callbacks] of this.subscribers) {
			if (!subjectMatches(pattern, subject)) continue;
			for (const cb of callbacks) {
				try {
					cb(data, subject);
				} catch {
					// Subscriber callback threw; ignore to protect other subscribers.
				}
			}
		}
	}

	private sendFrame(frame: Record<string, unknown>): void {
		const ws = this.ws;
		if (!ws || ws.readyState !== 1 /* OPEN */) return;
		ws.send(JSON.stringify(frame));
	}

	private emitConnectError(err: ConnectErrorPlaceholder): void {
		// Surface loudly via the structured connection-state listener channel.
		// TODO(G4): emit typed ConnectError instead of flattening to string state.
		this.setConnectionState('disconnected', { connectError: err });
	}

	private setConnected(value: boolean): void {
		if (this._connected === value) return;
		this._connected = value;
		for (const listener of this.statusListeners) {
			try {
				listener(value);
			} catch {
				// Protect against listener errors.
			}
		}
	}

	private setConnectionState(state: ConnectionState, detail?: Record<string, unknown>): void {
		this._connectionState = state;
		for (const l of this._stateListeners) {
			try {
				l(state, detail);
			} catch {
				// Protect against listener errors.
			}
		}
	}
}
