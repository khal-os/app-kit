import { useCallback, useReducer } from 'react';
import type { LogEntry } from './types';

const DEFAULT_CAPACITY = 1000;

type Action =
	| { type: 'push'; entry: Omit<LogEntry, 'id' | 'timestamp'> }
	| { type: 'clear' }
	| { type: 'set-capacity'; capacity: number };

interface State {
	entries: LogEntry[];
	capacity: number;
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case 'push': {
			const entry: LogEntry = {
				...action.entry,
				id: crypto.randomUUID(),
				timestamp: Date.now(),
			};
			const next = [...state.entries, entry];
			// Drop oldest entries when over capacity
			if (next.length > state.capacity) {
				return { ...state, entries: next.slice(next.length - state.capacity) };
			}
			return { ...state, entries: next };
		}
		case 'clear':
			return { ...state, entries: [] };
		case 'set-capacity': {
			const entries =
				state.entries.length > action.capacity
					? state.entries.slice(state.entries.length - action.capacity)
					: state.entries;
			return { capacity: action.capacity, entries };
		}
	}
}

export function useMessageBuffer(capacity = DEFAULT_CAPACITY) {
	const [state, dispatch] = useReducer(reducer, { entries: [], capacity });

	const push = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
		dispatch({ type: 'push', entry });
	}, []);

	const clear = useCallback(() => {
		dispatch({ type: 'clear' });
	}, []);

	return { entries: state.entries, push, clear };
}
