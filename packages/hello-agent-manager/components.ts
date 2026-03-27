'use client';
import { type ComponentType, lazy } from 'react';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'agent-manager': lazy(() => import('./views/agent-manager/AgentManager').then((m) => ({ default: m.AgentManager }))),
};
