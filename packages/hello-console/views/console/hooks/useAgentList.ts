'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNats } from '@/lib/hooks/use-nats';
import type { AgentInfo } from '../types';

interface UseAgentListReturn {
	agents: AgentInfo[];
	loading: boolean;
	error: string | null;
	refresh: () => void;
}

export function useAgentList(): UseAgentListReturn {
	const { request, connected } = useNats();
	const [agents, setAgents] = useState<AgentInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchAgents = useCallback(async () => {
		if (!connected) return;
		setLoading(true);
		setError(null);
		try {
			const response = (await request('hello.agent.list', {})) as {
				agents: AgentInfo[];
			};
			setAgents(response.agents ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch agent list');
			setAgents([]);
		} finally {
			setLoading(false);
		}
	}, [connected, request]);

	useEffect(() => {
		fetchAgents();
	}, [fetchAgents]);

	return { agents, loading, error, refresh: fetchAgents };
}
