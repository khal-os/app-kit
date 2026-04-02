'use client';
import type { ComponentType } from 'react';
import { AgentManager } from './views/agent-manager/AgentManager';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'agent-manager': AgentManager,
};
