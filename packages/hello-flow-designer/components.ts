'use client';
import type { ComponentType } from 'react';
import FlowDesignerApp from './views/flow-designer/ui/FlowDesignerApp';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'flow-designer': FlowDesignerApp,
};
