import { createHmac, timingSafeEqual } from 'node:crypto';
import { unsealData } from 'iron-session';
import { cookies, headers } from 'next/headers';
import { isLocalMode } from '../lib/local-mode';

/** Authenticated user returned by readSession(). */
export interface SessionUser {
	id: string;
	email?: string;
	firstName?: string;
	lastName?: string;
}

/** Result of readSession(). null means no valid auth. */
export interface SessionResult {
	user: SessionUser;
	/** True when auth came from HMAC signature, UA bypass, or local mode. */
	isMachine: boolean;
}

/** Synthetic machine user for headless/local bypass. */
const MACHINE_USER: SessionUser = {
	id: 'machine',
	email: 'machine@localhost',
	firstName: 'Machine',
	lastName: 'User',
};

/** HMAC timestamp tolerance in seconds (±5 minutes). */
const HMAC_TOLERANCE_SECONDS = 300;

/**
 * Verify HMAC-SHA256 machine signature.
 *
 * Spec: x-machine-signature = hex(HMAC-SHA256(OS_SECRET, timestamp))
 *       x-machine-timestamp = Unix seconds as string
 *       Tolerance: ±300s (5 min)
 */
function verifyHmacSignature(signature: string, timestamp: string, secret: string): boolean {
	const ts = Number.parseInt(timestamp, 10);
	if (Number.isNaN(ts)) return false;

	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - ts) > HMAC_TOLERANCE_SECONDS) return false;

	const expected = createHmac('sha256', secret).update(timestamp).digest('hex');
	if (expected.length !== signature.length) return false;

	return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

/**
 * Read the authenticated session from cookies or machine auth headers.
 *
 * Precedence:
 * 1. Cookie session (wos-session via iron-session) → return user
 * 2. HMAC machine signature (x-machine-signature + x-machine-timestamp) → machine user
 * 3. UA HeadlessChrome + OS_SECRET → machine user (backward compat)
 * 4. Local mode (no WORKOS_CLIENT_ID) → machine user
 * 5. None → null
 *
 * Designed for Next.js App Router API routes — uses next/headers, no req param needed.
 */
export async function readSession(): Promise<SessionResult | null> {
	// 1. Try cookie session
	const cookieName = process.env.WORKOS_COOKIE_NAME || 'wos-session';
	const password = process.env.WORKOS_COOKIE_PASSWORD || '';

	if (password) {
		const nextCookies = await cookies();
		const cookie = nextCookies.get(cookieName);
		if (cookie?.value) {
			try {
				const session = await unsealData<{
					user?: { id: string; email?: string; firstName?: string; lastName?: string };
				}>(cookie.value, { password });
				if (session.user) {
					return {
						user: {
							id: session.user.id,
							email: session.user.email,
							firstName: session.user.firstName,
							lastName: session.user.lastName,
						},
						isMachine: false,
					};
				}
			} catch {
				// Cookie unseal failed — fall through to other auth methods
			}
		}
	}

	// 2. HMAC machine signature
	const osSecret = process.env.OS_SECRET;
	if (osSecret) {
		const hdrs = await headers();
		const signature = hdrs.get('x-machine-signature');
		const timestamp = hdrs.get('x-machine-timestamp');
		if (signature && timestamp && verifyHmacSignature(signature, timestamp, osSecret)) {
			return { user: MACHINE_USER, isMachine: true };
		}

		// 3. UA HeadlessChrome fallback (backward compat)
		const ua = hdrs.get('user-agent') ?? '';
		if (ua.includes('HeadlessChrome')) {
			return { user: MACHINE_USER, isMachine: true };
		}
	}

	// 4. Local mode
	if (isLocalMode()) {
		return { user: MACHINE_USER, isMachine: true };
	}

	// 5. No auth
	return null;
}
