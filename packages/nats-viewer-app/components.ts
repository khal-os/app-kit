'use client';

import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'nats-viewer': lazy(() => import('./views/nats-viewer/NatsViewer').then((m) => ({ default: m.NatsViewer }))),
};
