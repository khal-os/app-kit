import { describe, expect, test } from 'bun:test';
import { type ConnectError, closeCodeToConnectError, isFatal } from './errors';

const CTX = {
	signInUrl: 'https://auth.example.com/sign-in',
	serverUrl: 'wss://kernel.example.com/ws/nats',
	clientVersion: '1.0.0',
};

describe('isFatal', () => {
	const matrix: Array<[ConnectError, boolean]> = [
		[{ kind: 'unauthenticated', signInUrl: '/x' }, true],
		[{ kind: 'token-expired', signInUrl: '/x' }, true],
		[{ kind: 'origin-rejected', reason: 'email-domain' }, true],
		[{ kind: 'version-mismatch', server: '1', client: '2' }, true],
		[{ kind: 'server-closed', code: 1000, transient: false }, true],
		[{ kind: 'server-closed', code: 1011, transient: true }, false],
		[{ kind: 'network' }, false],
		[{ kind: 'unreachable', serverUrl: 'x' }, false],
	];
	for (const [err, expected] of matrix) {
		test(`${err.kind} → ${expected}`, () => {
			expect(isFatal(err)).toBe(expected);
		});
	}
});

describe('closeCodeToConnectError', () => {
	test('4401 → unauthenticated + signInUrl', () => {
		const err = closeCodeToConnectError(4401, undefined, CTX);
		expect(err).toEqual({ kind: 'unauthenticated', signInUrl: CTX.signInUrl });
	});

	test('4410 → token-expired + signInUrl', () => {
		expect(closeCodeToConnectError(4410, undefined, CTX)).toEqual({
			kind: 'token-expired',
			signInUrl: CTX.signInUrl,
		});
	});

	test('4403 with JSON email → origin-rejected(email-domain, email)', () => {
		const reason = JSON.stringify({ error: 'email-domain', email: 'a@b.co' });
		expect(closeCodeToConnectError(4403, reason, CTX)).toEqual({
			kind: 'origin-rejected',
			reason: 'email-domain',
			email: 'a@b.co',
		});
	});

	test('4403 with plain email → origin-rejected(email-domain, email)', () => {
		expect(closeCodeToConnectError(4403, 'email-domain:user@acme.io', CTX)).toEqual({
			kind: 'origin-rejected',
			reason: 'email-domain',
			email: 'user@acme.io',
		});
	});

	test('4403 with "origin" reason → origin-rejected(origin-header)', () => {
		expect(closeCodeToConnectError(4403, 'origin not allowed', CTX)).toEqual({
			kind: 'origin-rejected',
			reason: 'origin-header',
			email: undefined,
		});
	});

	test('4426 → version-mismatch with server version parsed from JSON', () => {
		const reason = JSON.stringify({ error: 'version_mismatch', required: '1.0.25' });
		expect(closeCodeToConnectError(4426, reason, CTX)).toEqual({
			kind: 'version-mismatch',
			server: '1.0.25',
			client: CTX.clientVersion,
		});
	});

	test('1006 → network (transient, keep retrying)', () => {
		expect(closeCodeToConnectError(1006, undefined, CTX)).toEqual({ kind: 'network' });
	});

	test('1000 → server-closed, transient=false', () => {
		expect(closeCodeToConnectError(1000, 'bye', CTX)).toEqual({
			kind: 'server-closed',
			code: 1000,
			transient: false,
		});
	});

	test('1011 (server error) → server-closed, transient=true', () => {
		expect(closeCodeToConnectError(1011, undefined, CTX)).toEqual({
			kind: 'server-closed',
			code: 1011,
			transient: true,
		});
	});
});
