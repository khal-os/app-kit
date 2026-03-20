'use client';

import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	terminal: lazy(() => import('./views/terminal/ui/MultiTerminalApp').then((m) => ({ default: m.MultiTerminalApp }))),
};
