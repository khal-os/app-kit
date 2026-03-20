'use client';

import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	settings: lazy(() => import('./views/settings/Settings').then((m) => ({ default: m.Settings }))),
};
