'use client';

/**
 * Typed connection-error taxonomy shared by `TauriNatsClient` and
 * `BrowserNatsClient`. Every connection failure that reaches the UI comes
 * through this union — no bare `catch {}`, no untyped `Error` throws.
 *
 * Consumers (e.g. `ConnectingScreen`) branch on `kind` to decide the CTA:
 *  - `unauthenticated` / `token-expired` → "Sign in" button → `signInUrl`
 *  - `origin-rejected`                   → "Wrong email domain" message
 *  - `version-mismatch`                  → "Update the app" prompt
 *  - `unreachable` / `network`           → retry automatically
 *  - `server-closed` with `transient:true` → retry; `false` → stop and show error
 */
export type ConnectError =
	| { kind: 'unauthenticated'; signInUrl: string }
	| { kind: 'token-expired'; signInUrl: string }
	| {
			kind: 'origin-rejected';
			email?: string;
			reason: 'email-domain' | 'origin-header';
	  }
	| { kind: 'network' }
	| { kind: 'unreachable'; serverUrl: string }
	| { kind: 'version-mismatch'; server: string; client: string }
	| { kind: 'server-closed'; code: number; transient: boolean };

/**
 * Returns `true` when the error is terminal — user action is required before
 * retry makes sense. Returns `false` for transient / recoverable failures that
 * a retry loop should keep attempting.
 */
export function isFatal(err: ConnectError): boolean {
	switch (err.kind) {
		case 'unauthenticated':
		case 'token-expired':
		case 'origin-rejected':
		case 'version-mismatch':
			return true;
		case 'server-closed':
			return !err.transient;
		case 'network':
		case 'unreachable':
			return false;
	}
}

/**
 * Map a WebSocket close code (and optional reason) to a `ConnectError`.
 *
 * Kernel-defined codes (see `repos/core/src/lib/platform-jwt.ts`
 * `rejectToCloseCode` + the version-mismatch branch in `ws-server.ts`):
 *  - 4401 unauthenticated (invalid signature, missing/malformed token)
 *  - 4403 origin-rejected (email-domain or origin-header)
 *  - 4410 token-expired
 *  - 4426 version-mismatch
 *
 * Transport-level codes use IANA semantics:
 *  - 1000 normal closure                    → server-closed, transient=false
 *  - 1006 abnormal closure (network drop)    → network
 *  - 1011-1015 server errors                 → server-closed, transient=true
 *  - everything else                         → server-closed, transient=true
 */
export function closeCodeToConnectError(
	code: number,
	reason: string | undefined,
	ctx: { signInUrl: string; serverUrl: string; clientVersion: string }
): ConnectError {
	if (code === 4401) {
		return { kind: 'unauthenticated', signInUrl: ctx.signInUrl };
	}
	if (code === 4410) {
		return { kind: 'token-expired', signInUrl: ctx.signInUrl };
	}
	if (code === 4403) {
		const email = parseEmailFromReason(reason);
		const rsn = reason?.includes('origin') ? 'origin-header' : 'email-domain';
		return { kind: 'origin-rejected', email, reason: rsn };
	}
	if (code === 4426) {
		const required = parseServerVersionFromReason(reason);
		return {
			kind: 'version-mismatch',
			server: required ?? 'unknown',
			client: ctx.clientVersion,
		};
	}
	if (code === 1006) {
		return { kind: 'network' };
	}
	if (code === 1000) {
		return { kind: 'server-closed', code, transient: false };
	}
	return { kind: 'server-closed', code, transient: true };
}

/**
 * Reasons emitted by the kernel for 4403 include a JSON payload (e.g.
 * `{"error":"email-domain","email":"x@y"}` — either direction of the
 * handshake may strip it to a plain string, so parse defensively.
 */
function parseEmailFromReason(reason: string | undefined): string | undefined {
	if (!reason) return undefined;
	try {
		const parsed = JSON.parse(reason);
		if (typeof parsed === 'object' && parsed !== null && 'email' in parsed) {
			const email = (parsed as { email?: unknown }).email;
			return typeof email === 'string' ? email : undefined;
		}
	} catch {
		// Reason wasn't JSON — might be "email-domain:x@y" style; grep for @.
		const match = reason.match(/[\w.+-]+@[\w.-]+\.[\w-]+/);
		return match?.[0];
	}
	return undefined;
}

function parseServerVersionFromReason(reason: string | undefined): string | undefined {
	if (!reason) return undefined;
	try {
		const parsed = JSON.parse(reason);
		if (typeof parsed === 'object' && parsed !== null && 'required' in parsed) {
			const required = (parsed as { required?: unknown }).required;
			return typeof required === 'string' ? required : undefined;
		}
	} catch {}
	return undefined;
}
