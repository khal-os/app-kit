'use client';

import type { ConnectionState } from '@khal-os/types';
import { type ConnectError, closeCodeToConnectError } from './errors';
import {
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

/** Sign-in URL + client version — used to construct `ConnectError` values. */
export interface BrowserClientContext {
	/** Where the kernel points users who need to authenticate. */
	signInUrl: string;
	/** App version string; used for `version-mismatch` error payload. */
	clientVersion: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const WS_SUBPROTOCOL_VERSION = 'khal.v1';

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
	private readonly ctx: BrowserClientContext;

	/**
	 * @param readConfig  reader that returns the current browser enterprise config
	 * @param ctx         sign-in URL + client version used to enrich ConnectError payloads
	 * @param wsFactory   optional WebSocket constructor injection (defaults to global `WebSocket`) — used for tests
	 */
	constructor(
		readConfig: BrowserConfigReader,
		ctx?: Partial<BrowserClientContext>,
		wsFactory?: (url: string, protocols: string[]) => WebSocket
	) {
		this.readConfig = readConfig;
		this.ctx = {
			signInUrl: ctx?.signInUrl ?? '',
			clientVersion: ctx?.clientVersion ?? '0.0.0',
		};
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
		let serverUrl = '';
		try {
			const config = await this.readConfig();
			if (!config) {
				this.emitConnectError({ kind: 'unauthenticated', signInUrl: this.ctx.signInUrl });
				return;
			}
			if (!config.token) {
				this.emitConnectError({ kind: 'unauthenticated', signInUrl: this.ctx.signInUrl });
				return;
			}
			serverUrl = config.wsUrl;

			const protocols = [WS_SUBPROTOCOL_VERSION, `bearer.${config.token}`];
			const ws = this.wsFactory(config.wsUrl, protocols);
			this.ws = ws;

			ws.onopen = () => {
				// Server MUST echo our version as the first accepted protocol.
				// A bare WS lib picks the first offered protocol; mismatch → version-mismatch.
				if (ws.protocol && ws.protocol !== WS_SUBPROTOCOL_VERSION) {
					this.emitConnectError({
						kind: 'version-mismatch',
						server: ws.protocol || 'unknown',
						client: this.ctx.clientVersion,
					});
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
				const err = closeCodeToConnectError(ev.code, ev.reason, {
					signInUrl: this.ctx.signInUrl,
					serverUrl,
					clientVersion: this.ctx.clientVersion,
				});
				this.emitConnectError(err);
			};
		} catch {
			this.emitConnectError({ kind: 'unreachable', serverUrl });
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
		const errorText = String(frame.error ?? '');

		// `no responders` is informational, not actionable — it means the
		// caller asked for a subject that has no handler attached (yet).
		// The downstream request() Promise still rejects, so consumers can
		// handle it; spamming warn-level logs for every polling caller
		// (OrphanSessionToast, warm-pool probes, optional features) floods
		// DevTools and hides real failures. Downgrade to debug.
		const isNoResponders = /no responders/i.test(errorText) || reason === 'req failed';
		const log = isNoResponders
			? // biome-ignore lint/suspicious/noConsole: SDK instrumentation, downgraded to debug
				console.debug
			: // biome-ignore lint/suspicious/noConsole: SDK instrumentation
				console.warn;

		if (reason && subject) {
			log.call(console, `[nats-client-browser] ${reason}: ${subject} — ${frame.error}`);
		} else if (reason) {
			log.call(console, `[nats-client-browser] ${reason}: ${frame.error}`);
		} else {
			log.call(console, '[nats-client-browser] server error:', frame.error);
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

	private emitConnectError(err: ConnectError): void {
		// Surface loudly via the structured connection-state listener channel —
		// callers branch on `err.kind` to pick UX. The state is always
		// 'disconnected' on connect-error paths; retry/resume is owned by the
		// caller (e.g. ws-retry in repos/desktop).
		this.setConnectionState('disconnected', err);
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

	private setConnectionState(state: ConnectionState, err?: ConnectError): void {
		this._connectionState = state;
		for (const l of this._stateListeners) {
			try {
				l(state, err);
			} catch {
				// Protect against listener errors.
			}
		}
	}
}
