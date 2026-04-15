'use client';

import { TauriNatsClient } from './nats-client';
import { type BrowserConfigReader, type BrowserEnterpriseConfig, BrowserNatsClient } from './nats-client-browser';
import type { NatsClientTransport } from './nats-client-transport';

interface TauriGlobal {
	__TAURI__?: unknown;
}

const LAST_USED_KEY = 'khal:enterprise:_lastUsed';
const KEY_PREFIX = 'khal:enterprise:';

/**
 * Default browser config reader — reads the enterprise config written by the
 * desktop PWA browser adapter (`repos/desktop/.../adapters/browser.ts`). Kept
 * inline so the SDK has zero runtime dependency on the desktop repo.
 */
async function defaultBrowserReadConfig(): Promise<BrowserEnterpriseConfig | null> {
	if (typeof window === 'undefined') return null;
	const lastUsed = window.localStorage.getItem(LAST_USED_KEY);
	if (lastUsed) {
		const raw = window.localStorage.getItem(`${KEY_PREFIX}${lastUsed}`);
		if (raw) {
			try {
				return JSON.parse(raw) as BrowserEnterpriseConfig;
			} catch {
				// fall through to scan
			}
		}
	}
	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i);
		if (!key || !key.startsWith(KEY_PREFIX) || key === LAST_USED_KEY) continue;
		const raw = window.localStorage.getItem(key);
		if (!raw) continue;
		try {
			return JSON.parse(raw) as BrowserEnterpriseConfig;
		} catch {}
	}
	return null;
}

function isTauriEnvironment(): boolean {
	if (typeof window === 'undefined') return false;
	return Boolean((window as unknown as TauriGlobal).__TAURI__);
}

let instance: NatsClientTransport | null = null;

/**
 * Get the singleton NATS client. Picks the transport at first call:
 *  - `TauriNatsClient` when `window.__TAURI__` is present (desktop app)
 *  - `BrowserNatsClient` everywhere else (PWA, web)
 *
 * Pass `opts.readBrowserConfig` to inject a custom config reader (tests, or
 * when the PWA adopts a non-localStorage storage backend).
 */
export function getNatsClient(opts?: { readBrowserConfig?: BrowserConfigReader }): NatsClientTransport {
	if (instance) return instance;
	if (isTauriEnvironment()) {
		instance = new TauriNatsClient();
	} else {
		instance = new BrowserNatsClient(opts?.readBrowserConfig ?? defaultBrowserReadConfig);
	}
	return instance;
}

/**
 * Test-only hook: reset the module-level singleton so subsequent `getNatsClient()`
 * calls observe a fresh environment (e.g. toggling `window.__TAURI__`).
 */
export function _resetNatsClientForTests(): void {
	instance = null;
}
