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

/**
 * Exposes the parent window's focused/active state to child components.
 * Apps use this to pause polling, animations, and heavy rendering when
 * their window is behind another (app-nap behavior).
 */
const WindowActiveContext = createContext(true);

export const WindowActiveProvider = WindowActiveContext.Provider;

export function useWindowActive(): boolean {
	return useContext(WindowActiveContext);
}
