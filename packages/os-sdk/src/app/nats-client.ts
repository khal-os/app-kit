'use client';

import type { ConnectionState } from '@khal-os/types';

type MessageCallback = (data: unknown, subject: string) => void;
type StatusCallback = (connected: boolean) => void;

interface PendingRequest {
	resolve: (data: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

type ConnectionStateListener = (state: ConnectionState, detail?: Record<string, unknown>) => void;

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
 * Match a concrete NATS subject against a subscription pattern.
 *  - `*` matches exactly one token
 *  - `>` (must be last token) matches one or more tokens
 *  - everything else is a literal match
 */
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

/**
 * Native Tauri NATS client.
 *
 * Communicates with the Rust WS relay via Tauri Channel IPC (in-process,
 * no network). The Rust side handles the actual WebSocket connection to
 * the remote KhalOS server. This client is the ONLY transport supported —
 * there is no browser WebSocket fallback, no local dev mode.
 *
 * Requires `window.__TAURI__` to be available. Throws if loaded outside
 * a Tauri webview context.
 */
class NatsClient {
	private _connected = false;

	// subject -> Set of callbacks (refcounted)
	private subscribers = new Map<string, Set<MessageCallback>>();

	// correlation id -> pending request
	private pendingRequests = new Map<string, PendingRequest>();

	// status change listeners
	private statusListeners = new Set<StatusCallback>();

	// Identity scoping
	private _orgId = '';
	private _userId = '';

	// Tauri connection state
	private connId: string | null = null;

	// Connection state
	private _connectionState: ConnectionState = 'disconnected';
	private _stateListeners: Array<ConnectionStateListener> = [];

	constructor() {
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

	/** Current connection state. */
	get connectionState(): ConnectionState {
		return this._connectionState;
	}

	/** Set the organization ID used for subject scoping. */
	setOrgId(orgId: string): void {
		this._orgId = orgId;
	}

	/** Set the user ID used for subject scoping. */
	setUserId(userId: string): void {
		this._userId = userId;
	}

	/** Register a callback invoked when connection status changes. Returns an unsubscribe function. */
	onStatusChange(callback: StatusCallback): () => void {
		this.statusListeners.add(callback);
		return () => {
			this.statusListeners.delete(callback);
		};
	}

	/**
	 * Register a callback invoked when the connection state changes.
	 * Provides richer state info than `onStatusChange` (reconnecting, auth_expired, etc.).
	 * Returns an unsubscribe function.
	 */
	onConnectionStateChange(listener: ConnectionStateListener): () => void {
		this._stateListeners.push(listener);
		return () => {
			this._stateListeners = this._stateListeners.filter((l) => l !== listener);
		};
	}

	/**
	 * Subscribe to a NATS subject. Supports `*` (single-token) and `>` (multi-token) wildcards.
	 * Returns an unsubscribe function. The server-side subscription is reference-counted:
	 * a `sub` frame is sent on first subscriber, `unsub` on last removal.
	 */
	subscribe(subject: string, callback: MessageCallback): () => void {
		let callbacks = this.subscribers.get(subject);
		if (!callbacks) {
			callbacks = new Set();
			this.subscribers.set(subject, callbacks);
			// First subscriber for this subject: send sub frame
			this.sendFrame({ op: 'sub', subject });
		}
		callbacks.add(callback);

		// Return unsubscribe function
		return () => {
			const cbs = this.subscribers.get(subject);
			if (!cbs) return;
			cbs.delete(callback);
			if (cbs.size === 0) {
				this.subscribers.delete(subject);
				// Last subscriber removed: send unsub frame
				this.sendFrame({ op: 'unsub', subject });
			}
		};
	}

	/** Publish a message to a NATS subject (fire-and-forget). */
	publish(subject: string, data?: unknown): void {
		this.sendFrame({ op: 'pub', subject, data });
	}

	/**
	 * Send a request to a NATS subject and await a reply.
	 * Uses a correlation ID for matching. Rejects on timeout.
	 */
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

	/**
	 * Connect via Tauri Channel IPC.
	 * Uses the Rust WS relay to connect to the remote KhalOS server.
	 * Throws if Tauri IPC is not available (e.g., loaded outside a Tauri webview).
	 */
	private async connectViaTauri(): Promise<void> {
		const tauri = (window as TauriGlobal).__TAURI__;
		if (!tauri?.core) {
			throw new Error('[nats-client] Tauri IPC not available. This SDK only runs inside the Khal OS desktop app.');
		}

		try {
			// Get auth config from Tauri (stored in Rust AppState)
			const config = (await tauri.core.invoke('get_enterprise_config')) as EnterpriseConfig | null;
			if (!config) {
				throw new Error('Enterprise config not available — user is not signed in');
			}

			// Create a Tauri Channel for receiving messages from the Rust relay
			const channel = new tauri.core.Channel<string>();

			channel.onmessage = (frame: string) => {
				// Check for connection state messages from the relay
				try {
					const parsed = JSON.parse(frame) as Record<string, unknown>;
					if (parsed.type === '_state') {
						const stateMsg = parsed as unknown as RelayStateMessage;
						const state = stateMsg.state as ConnectionState;
						this.setConnectionState(state, parsed);

						// Update simple connected flag based on state
						if (state === 'connected') {
							this.setConnected(true);
							// Re-subscribe all active subjects after reconnection
							for (const subject of this.subscribers.keys()) {
								this.sendFrame({ op: 'sub', subject });
							}
						} else if (state === 'disconnected' || state === 'auth_expired' || state === 'version_mismatch') {
							this.setConnected(false);
						}
						return;
					}
				} catch {
					// Not JSON or not a state message — fall through to handle as NATS frame
				}

				// Regular NATS frame — handle normally
				this.handleMessage(frame);
			};

			const connId = (await tauri.core.invoke('connect_enterprise_ws', {
				url: config.wsUrl,
				token: config.token,
				version: config.version || '0.0.0',
				onMessage: channel,
			})) as string;

			this.connId = connId;
			this.setConnected(true);
			this.setConnectionState('connected');
		} catch (err) {
			// biome-ignore lint/suspicious/noConsole: connection error logging
			console.error('[nats-client] connection failed:', err);
			this.setConnectionState('disconnected');
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

	/** Send a JSON frame via Tauri Channel IPC to the Rust WS relay. */
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

// --- Tauri global type (available via withGlobalTauri: true) ---

/** Minimal type for the Tauri Channel constructor exposed on `window.__TAURI__`. */
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

// Singleton
let instance: NatsClient | null = null;

/** Get the singleton NATS client. Creates the instance (and connects) on first call. */
export function getNatsClient(): NatsClient {
	if (!instance) {
		instance = new NatsClient();
	}
	return instance;
}
