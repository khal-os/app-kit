'use client';

import type { KhalAuth } from '@khal-os/types';
import { useKhalAuthContext } from './auth-context';

export type { KhalAuth } from '@khal-os/types';

/**
 * Client-side hook that provides Khal auth state.
 * Reads from the nearest KhalAuthProvider (WorkOS on web, Tauri on desktop).
 * Returns null when not authenticated or no provider present.
 */
export function useKhalAuth(): KhalAuth | null {
	return useKhalAuthContext();
}
