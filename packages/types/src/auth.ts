/** Authenticated user state returned by `useKhalAuth`. */
export interface KhalAuth {
	userId: string;
	orgId: string;
	role: string;
	permissions: string[];
	loading: boolean;
	/** WorkOS-provided profile fields propagated via the platform JWT. All
	 *  optional — callers MUST fall back to `userId`/`email` when absent. */
	email?: string;
	name?: string;
	picture?: string;
}
