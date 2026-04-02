'use client';

import type { KhalAuth } from '@khal-os/types';
import { createContext, useContext } from 'react';

/**
 * Context for providing KhalAuth state to the app.
 * Each platform (web/WorkOS, desktop/Tauri) supplies its own provider.
 */
export const KhalAuthContext = createContext<KhalAuth | null>(null);

/**
 * Internal hook — reads auth state from the nearest KhalAuthProvider.
 * Returns null when no provider is present or user is unauthenticated.
 */
export function useKhalAuthContext(): KhalAuth | null {
	return useContext(KhalAuthContext);
}
