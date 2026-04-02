/** Authenticated user state returned by `useKhalAuth`. */
export interface KhalAuth {
	userId: string;
	orgId: string;
	role: string;
	permissions: string[];
	loading: boolean;
}
