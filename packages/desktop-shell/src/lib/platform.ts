import { useSyncExternalStore } from 'react';

export type Platform = 'macos' | 'windows' | 'linux';

function detectPlatform(): Platform {
	if (typeof navigator === 'undefined') return 'linux';

	// Modern API (Chromium 93+, also available in Tauri webview)
	const uaPlatform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform;
	if (uaPlatform) {
		const p = uaPlatform.toLowerCase();
		if (p === 'macos') return 'macos';
		if (p === 'windows') return 'windows';
		return 'linux';
	}

	// Legacy fallback (works in all browsers + Tauri)
	// navigator.platform is deprecated but still the best sync fallback
	const p = String((navigator as unknown as { platform?: string }).platform ?? '').toLowerCase();
	if (p.startsWith('mac')) return 'macos';
	if (p.startsWith('win')) return 'windows';
	return 'linux';
}

let cached: Platform | undefined;

/** Synchronous platform detection with caching. */
export function getPlatform(): Platform {
	if (!cached) cached = detectPlatform();
	return cached;
}

// useSyncExternalStore glue — platform never changes at runtime
const subscribe = () => () => {};
function getSnapshot(): Platform {
	return getPlatform();
}
function getServerSnapshot(): Platform {
	return 'linux';
}

/** React hook for platform detection. Returns 'macos', 'windows', or 'linux'. */
export function usePlatform(): Platform {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
