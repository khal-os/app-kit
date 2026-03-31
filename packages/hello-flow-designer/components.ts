'use client';
import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'flow-designer': lazy(() => import('./views/flow-designer/ui/FlowDesignerApp')),
};
