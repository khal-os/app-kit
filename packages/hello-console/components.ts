'use client';
import type { ComponentType } from 'react';
import { Console } from './views/console/Console';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	console: Console,
};
