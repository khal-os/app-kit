const KEY_PREFIX = 'khal:cmd:';
const TTL_MS = 10_000;

let _tabId: string;
function tabId() {
	if (!_tabId) _tabId = Math.random().toString(36).slice(2);
	return _tabId;
}

/** djb2 hash -- fast, deterministic, good distribution */
function djb2(str: string): string {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return (hash >>> 0).toString(36);
}

/** Derive a stable cmdId from subject + payload. All tabs compute the same value. */
export function deriveCommandId(subject: string, payload: string): string {
	const bucket = Math.floor(Date.now() / 5000); // 5s window
	return djb2(subject + payload + bucket);
}

/**
 * Try to claim a command via localStorage. Returns true if this tab should process it.
 *
 * Uses per-cmdId keys with write-then-verify (optimistic lock).
 * Each tab writes its unique tabId, then reads back to confirm it won.
 * This eliminates the TOCTOU race of the old JSON-blob approach.
 */
export function claimCommand(cmdId: string): boolean {
	try {
		const key = KEY_PREFIX + cmdId;

		// Fast path: already claimed by another tab
		if (localStorage.getItem(key) !== null) return false;

		// Write our claim
		const id = tabId();
		localStorage.setItem(key, id);

		// Verify we won the race (last writer wins, but read-back is consistent)
		if (localStorage.getItem(key) !== id) return false;

		// Schedule cleanup
		setTimeout(() => {
			try {
				localStorage.removeItem(key);
			} catch {}
		}, TTL_MS);
		return true;
	} catch {
		// localStorage unavailable (SSR, private mode quota) -- allow execution
		return true;
	}
}
