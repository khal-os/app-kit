'use client';

import { useNats } from '@khal-os/sdk/app';
import { useCallback, useEffect, useState } from 'react';
import { AGENT_CONFIG, AGENT_LIST } from '../subjects';
import type { AgentConfig, AgentInfo } from '../types';

interface UseAgentConfigReturn {
	agents: AgentInfo[];
	selectedConfig: AgentConfig | null;
	loading: boolean;
	error: string | null;
	refresh: () => void;
	fetchConfig: (slug: string) => Promise<void>;
	saveConfig: (config: Partial<AgentConfig> & { slug: string }) => Promise<void>;
}

export function useAgentConfig(): UseAgentConfigReturn {
	const { request, connected } = useNats();
	const [agents, setAgents] = useState<AgentInfo[]>([]);
	const [selectedConfig, setSelectedConfig] = useState<AgentConfig | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchAgents = useCallback(async () => {
		if (!connected) return;
		setLoading(true);
		setError(null);
		try {
			const response = (await request(AGENT_LIST, {})) as { agents: AgentInfo[] };
			setAgents(response.agents ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch agents');
			setAgents([]);
		} finally {
			setLoading(false);
		}
	}, [connected, request]);

	const fetchConfig = useCallback(
		async (slug: string) => {
			if (!connected) return;
			try {
				const response = (await request(AGENT_CONFIG, { slug })) as AgentConfig;
				setSelectedConfig(response);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to fetch agent config');
			}
		},
		[connected, request]
	);

	const saveConfig = useCallback(
		async (config: Partial<AgentConfig> & { slug: string }) => {
			if (!connected) return;
			try {
				await request('hello.agent.create', config);
				// Refresh the config after save
				await fetchConfig(config.slug);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to save agent config');
			}
		},
		[connected, request, fetchConfig]
	);

	useEffect(() => {
		fetchAgents();
	}, [fetchAgents]);

	return {
		agents,
		selectedConfig,
		loading,
		error,
		refresh: fetchAgents,
		fetchConfig,
		saveConfig,
	};
}
