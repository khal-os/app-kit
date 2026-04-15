'use client';

import type { ConnectionState } from '@khal-os/types';
import type { ConnectError } from './errors';
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

/** Shape of `_state` messages from the Rust WS relay Channel. */
interface RelayStateMessage {
	type: '_state';
	state: string;
	[key: string]: unknown;
}

/** Enterprise config returned by `get_enterprise_config` Tauri command. */
interface EnterpriseConfig {
	wsUrl: string;
	token: string;
	version?: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

/**
 * Native Tauri NATS client.
 *
 * Communicates with the Rust WS relay via Tauri Channel IPC (in-process,
 * no network). The Rust side handles the actual WebSocket connection to
 * the remote KhalOS server.
 *
 * Requires `window.__TAURI__` to be available. Throws if loaded outside
 * a Tauri webview context. For browser/PWA use, see `BrowserNatsClient`
 * and the `getNatsClient()` factory.
 */
export class TauriNatsClient implements NatsClientTransport {
	private _connected = false;

	// subject -> Set of callbacks (refcounted)
	private subscribers = new Map<string, Set<NatsMessageCallback>>();

	// correlation id -> pending request
	private pendingRequests = new Map<string, PendingRequest>();

	// status change listeners
	private statusListeners = new Set<NatsStatusCallback>();

	// Identity scoping
	private _orgId = '';
	private _userId = '';

	// Tauri connection state
	private connId: string | null = null;

	// Connection state
	private _connectionState: ConnectionState = 'disconnected';
	private _stateListeners: Array<NatsConnectionStateListener> = [];
	private readonly signInUrl: string;
	private readonly clientVersion: string;

	constructor(ctx?: { signInUrl?: string; clientVersion?: string }) {
		this.signInUrl = ctx?.signInUrl ?? '';
		this.clientVersion = ctx?.clientVersion ?? '0.0.0';
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

	private connect(): void {
		if (typeof window === 'undefined') return;
		this.connectViaTauri();
	}

	private async connectViaTauri(): Promise<void> {
		const tauri = (window as TauriGlobal).__TAURI__;
		if (!tauri?.core) {
			// No Tauri IPC — caller loaded this in a browser context by mistake.
			// Surface as `unreachable` (no sign-in CTA helps here; the app itself
			// is in the wrong environment).
			this.setConnectionState('disconnected', { kind: 'unreachable', serverUrl: '' });
			return;
		}

		let serverUrl = '';
		try {
			const config = (await tauri.core.invoke('get_enterprise_config')) as EnterpriseConfig | null;
			if (!config) {
				this.setConnectionState('disconnected', {
					kind: 'unauthenticated',
					signInUrl: this.signInUrl,
				});
				return;
			}
			serverUrl = config.wsUrl;

			const channel = new tauri.core.Channel<string>();

			channel.onmessage = (frame: string) => {
				try {
					const parsed = JSON.parse(frame) as Record<string, unknown>;
					if (parsed.type === '_state') {
						const stateMsg = parsed as unknown as RelayStateMessage;
						const state = stateMsg.state as ConnectionState;
						const err = tauriStateToConnectError(state, parsed, {
							signInUrl: this.signInUrl,
							serverUrl,
							clientVersion: this.clientVersion,
						});
						this.setConnectionState(state, err);

						if (state === 'connected') {
							this.setConnected(true);
							for (const subject of this.subscribers.keys()) {
								this.sendFrame({ op: 'sub', subject });
							}
						} else if (state === 'disconnected' || state === 'auth_expired' || state === 'version_mismatch') {
							this.setConnected(false);
						}
						return;
					}
				} catch {
					// fall through
				}

				this.handleMessage(frame);
			};

			const connId = (await tauri.core.invoke('connect_enterprise_ws', {
				url: config.wsUrl,
				token: config.token,
				version: config.version || this.clientVersion,
				onMessage: channel,
			})) as string;

			this.connId = connId;
			this.setConnected(true);
			this.setConnectionState('connected');
		} catch (err) {
			// The Rust relay surfaces auth/version failures via sentinel strings
			// (`__AUTH_EXPIRED__...`, `__VERSION_MISMATCH__...`) inside the
			// thrown error message — translate those into typed ConnectError.
			const msg = err instanceof Error ? err.message : String(err);
			const parsed = parseTauriInvokeError(msg, {
				signInUrl: this.signInUrl,
				serverUrl,
				clientVersion: this.clientVersion,
			});
			this.setConnectionState('disconnected', parsed);
		}
	}

	private handleMessage(raw: string | ArrayBuffer | Blob): void {
		if (typeof raw !== 'string') return;

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
			console.warn(`[nats-client] ${reason}: ${subject} — ${frame.error}`);
		} else if (reason) {
			// biome-ignore lint/suspicious/noConsole: client-side debug logging for NATS errors
			console.warn(`[nats-client] ${reason}: ${frame.error}`);
		} else {
			// biome-ignore lint/suspicious/noConsole: client-side debug logging for NATS errors
			console.warn('[nats-client] server error:', frame.error);
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
		if (!this.connId) return;

		const tauri = (window as TauriGlobal).__TAURI__;
		tauri?.core?.invoke('send_enterprise_ws', {
			connId: this.connId,
			data: JSON.stringify(frame),
		});
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

/**
 * @deprecated Use `TauriNatsClient` directly, or `getNatsClient()` for the
 * transport-agnostic factory. Retained as a type alias for backward compatibility.
 */
export type NatsClient = TauriNatsClient;

// --- Tauri global type (available via withGlobalTauri: true) ---

interface TauriChannel<T> {
	onmessage: (message: T) => void;
}

interface TauriChannelConstructor {
	new <T>(): TauriChannel<T>;
}

interface TauriGlobal {
	__TAURI__?: {
		core: {
			invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
			Channel: TauriChannelConstructor;
		};
	};
}

/**
 * Translate a Tauri relay `_state` frame to a ConnectError, if any. Returns
 * `undefined` on benign transitions (connecting/connected) and a typed error
 * on the failure states.
 */
function tauriStateToConnectError(
	state: ConnectionState,
	detail: Record<string, unknown>,
	ctx: { signInUrl: string; serverUrl: string; clientVersion: string }
): ConnectError | undefined {
	if (state === 'auth_expired') {
		return { kind: 'token-expired', signInUrl: ctx.signInUrl };
	}
	if (state === 'version_mismatch') {
		const required = typeof detail.required === 'string' ? detail.required : 'unknown';
		return { kind: 'version-mismatch', server: required, client: ctx.clientVersion };
	}
	if (state === 'disconnected') {
		// The relay doesn't carry a close-code up through the channel today —
		// treat as transient network drop so retry loops keep going.
		return { kind: 'network' };
	}
	return undefined;
}

/**
 * Parse the sentinel strings the Rust WS relay emits in `connect_enterprise_ws`
 * rejections (see repos/core/tauri/src/ws_relay.rs). Fallback to `unreachable`.
 */
function parseTauriInvokeError(
	msg: string,
	ctx: { signInUrl: string; serverUrl: string; clientVersion: string }
): ConnectError {
	if (msg.includes('__AUTH_EXPIRED__')) {
		return { kind: 'token-expired', signInUrl: ctx.signInUrl };
	}
	if (msg.includes('__VERSION_MISMATCH__')) {
		const tail = msg.split('__VERSION_MISMATCH__')[1] ?? '';
		let required = 'unknown';
		try {
			const parsed = JSON.parse(tail);
			if (parsed && typeof parsed.required === 'string') required = parsed.required;
		} catch {}
		return { kind: 'version-mismatch', server: required, client: ctx.clientVersion };
	}
	return { kind: 'unreachable', serverUrl: ctx.serverUrl };
}
