'use client';

import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'hello-sac': lazy(() => import('./views/hello-sac/SACApp').then((m) => ({ default: m.SACApp }))),
};
