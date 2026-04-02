import { type NextRequest, NextResponse } from 'next/server';
import { type Database, getDb } from '../db/factory';
import { readSession } from './session';

export interface ApiUser {
	id: string;
	email?: string;
	firstName?: string;
	lastName?: string;
}

export interface ApiContext {
	/** Authenticated user. Always present (401 returned if not). */
	user: ApiUser;
	/** Original Next.js request. */
	req: NextRequest;
	/** True when auth came from HMAC signature, UA bypass, or local mode. */
	isMachine: boolean;
}

export interface ApiContextWithDb extends ApiContext {
	/** Drizzle database instance. */
	db: Database;
}

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<Response>;

/**
 * Wraps an API route handler with auth via readSession().
 * Returns 401 JSON if the user is not authenticated.
 */
export function apiHandler(fn: (ctx: ApiContext) => Promise<Response>): RouteHandler {
	return async (req: NextRequest, ..._args: unknown[]) => {
		const session = await readSession();
		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		return fn({ user: session.user, req, isMachine: session.isMachine });
	};
}

/**
 * Wraps an API route handler with auth + db resolution via readSession().
 * Returns 401 JSON if the user is not authenticated.
 */
export function apiHandlerWithDb(fn: (ctx: ApiContextWithDb) => Promise<Response>): RouteHandler {
	return async (req: NextRequest, ..._args: unknown[]) => {
		const session = await readSession();
		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const db = getDb();
		return fn({ user: session.user, req, db, isMachine: session.isMachine });
	};
}
