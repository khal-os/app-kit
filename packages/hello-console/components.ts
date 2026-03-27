'use client';
import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	console: lazy(() => import('./views/console/Console').then((m) => ({ default: m.Console }))),
};
