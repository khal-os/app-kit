import { useNats } from '@khal-os/sdk/app';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentConfig } from '../types';

export function useAgents() {
	const { request, subscribe, connected } = useNats();
	const [agents, setAgents] = useState<AgentConfig[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const mountedRef = useRef(true);

	const refresh = useCallback(async () => {
		if (!connected) return;
		setLoading(true);
		setError(null);
		try {
			const res = (await request('os.hello.agents.list', {})) as {
				agents?: AgentConfig[];
				error?: string;
			};
			if (!mountedRef.current) return;
			if (res.error) {
				setError(res.error);
			} else {
				setAgents(res.agents ?? []);
			}
		} catch (err) {
			if (!mountedRef.current) return;
			setError(err instanceof Error ? err.message : 'Failed to load agents');
		} finally {
			if (mountedRef.current) setLoading(false);
		}
	}, [connected, request]);

	useEffect(() => {
		mountedRef.current = true;
		refresh();
		return () => {
			mountedRef.current = false;
		};
	}, [refresh]);

	useEffect(() => {
		if (!connected) return;
		const unsub = subscribe('hello.*.event.call_state', (msg: unknown) => {
			const data = msg as { slug?: string; status?: AgentConfig['status'] };
			if (!data.slug || !data.status) return;
			setAgents((prev) => prev.map((a) => (a.slug === data.slug ? { ...a, status: data.status! } : a)));
		});
		return unsub;
	}, [connected, subscribe]);

	return { agents, loading, error, refresh };
}
