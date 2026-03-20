'use client';

import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	files: lazy(() => import('./views/files/FilesApp').then((m) => ({ default: m.FilesApp }))),
};
