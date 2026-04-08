'use client';

import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'{{name}}': lazy(() => import('./views/{{name}}/ui/App').then((m) => ({ default: m.{{componentName}} }))),
};
