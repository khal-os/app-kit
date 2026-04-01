'use client';

import type { ComponentType } from 'react';
import { GenieApp } from './views/genie/ui/GenieApp';
import { PipelineView } from './views/pipeline/ui/PipelineView';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export const components: Record<string, ComponentType<AppComponentProps>> = {
	genie: GenieApp,
	pipeline: PipelineView,
};
