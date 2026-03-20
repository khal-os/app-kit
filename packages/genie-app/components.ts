'use client';

import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	genie: lazy(() => import('./views/genie/ui/GenieApp').then((m) => ({ default: m.GenieApp }))),
};
