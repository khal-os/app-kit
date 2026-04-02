/**
 * Detect whether the instance is running in local mode (no WorkOS auth).
 *
 * Local mode is active when:
 * - NEXT_PUBLIC_KHAL_MODE is explicitly 'local', OR
 * - WORKOS_CLIENT_ID is missing or set to a known placeholder
 *
 * This mirrors the condition in src/middleware.ts and must stay in sync.
 * When WORKOS_CLIENT_ID is set to a real value, this returns false and
 * only authenticated WorkOS users can access the system.
 */
export function isLocalMode(): boolean {
	if (process.env.NEXT_PUBLIC_KHAL_MODE === 'local') return true;
	const clientId = process.env.WORKOS_CLIENT_ID;
	return !clientId || clientId === 'npx-local-mode' || clientId === 'placeholder';
}
