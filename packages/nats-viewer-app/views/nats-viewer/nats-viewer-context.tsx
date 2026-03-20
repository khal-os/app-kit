'use client';

import { createContext, useContext } from 'react';
import type { LogEntry } from './types';

// ---------------------------------------------------------------------------
// Context — shared state for sidebar panels and the main log area
// ---------------------------------------------------------------------------

export interface NatsViewerContextValue {
	subscriptions: Set<string>;
	addSubscription: (subject: string) => void;
	removeSubscription: (subject: string) => void;
	buffer: {
		entries: LogEntry[];
		push: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
		clear: () => void;
	};
	filter: string;
	setFilter: (f: string) => void;
	paused: boolean;
	setPaused: (p: boolean) => void;
}

export const NatsViewerContext = createContext<NatsViewerContextValue | null>(null);

export function useNatsViewer(): NatsViewerContextValue {
	const ctx = useContext(NatsViewerContext);
	if (!ctx) throw new Error('useNatsViewer must be used within <NatsViewer>');
	return ctx;
}
