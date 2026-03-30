import { withAuth } from '@workos-inc/authkit-nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { type Database, getDb } from '../db/factory';
import { isLocalMode } from '../lib/local-mode';

export interface ApiContext {
	/** Authenticated WorkOS user. Always present (401 returned if not). */
	user: NonNullable<Awaited<ReturnType<typeof withAuth>>['user']>;
	/** Original Next.js request. */
	req: NextRequest;
}

export interface ApiContextWithDb extends ApiContext {
	/** Drizzle database instance. */
	db: Database;
}

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<Response>;

/** Synthetic machine user for headless Chrome bypass. */
const MACHINE_USER = {
	id: 'machine',
	email: 'machine@localhost',
	emailVerified: true,
	firstName: 'Machine',
	lastName: 'User',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	object: 'user' as const,
} as NonNullable<Awaited<ReturnType<typeof withAuth>>['user']>;

/** Check if the request is from headless Chrome with OS_SECRET enabled. */
function isHeadlessChrome(req: NextRequest): boolean {
	return Boolean(process.env.OS_SECRET && (req.headers.get('user-agent') ?? '').includes('HeadlessChrome'));
}

/**
 * Wraps an API route handler with auth.
 * Returns 401 if the user is not authenticated.
 */
export function apiHandler(fn: (ctx: ApiContext) => Promise<Response>): RouteHandler {
	return async (req: NextRequest, ..._args: unknown[]) => {
		const auth = await withAuth();
		if (!auth.user && !isHeadlessChrome(req) && !isLocalMode()) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const user = auth.user ?? MACHINE_USER;
		return fn({ user, req });
	};
}

/**
 * Wraps an API route handler with auth + db resolution.
 * Returns 401 if the user is not authenticated.
 */
export function apiHandlerWithDb(fn: (ctx: ApiContextWithDb) => Promise<Response>): RouteHandler {
	return async (req: NextRequest, ..._args: unknown[]) => {
		const auth = await withAuth();
		if (!auth.user && !isHeadlessChrome(req) && !isLocalMode()) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const user = auth.user ?? MACHINE_USER;
		const db = getDb();
		return fn({ user, db, req });
	};
}
