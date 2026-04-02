'use client';

import type { ComponentType } from 'react';
import { SACApp } from './views/hello-sac/SACApp';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	'hello-sac': SACApp,
};
