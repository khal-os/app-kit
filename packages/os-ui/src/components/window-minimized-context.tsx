'use client';

import { createContext, useContext } from 'react';

/**
 * Exposes the parent window's minimized state to deeply nested child components.
 * Terminal panes use this to dispose WebGL contexts when minimized (GPU savings)
 * and re-attach them on restore.
 */
const WindowMinimizedContext = createContext(false);

export const WindowMinimizedProvider = WindowMinimizedContext.Provider;

export function useWindowMinimized(): boolean {
	return useContext(WindowMinimizedContext);
}
