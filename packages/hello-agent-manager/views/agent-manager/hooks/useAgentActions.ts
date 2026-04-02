import { useNats } from '@khal-os/sdk/app';
import { useCallback, useState } from 'react';

export function useAgentActions(onRefresh: () => void) {
	const { request } = useNats();
	const [pending, setPending] = useState<string | null>(null);

	const startAgent = useCallback(
		async (slug: string) => {
			setPending(slug);
			try {
				await request('os.hello.agents.start', { slug });
				onRefresh();
			} finally {
				setPending(null);
			}
		},
		[request, onRefresh]
	);

	const stopAgent = useCallback(
		async (slug: string) => {
			setPending(slug);
			try {
				await request('os.hello.agents.stop', { slug });
				onRefresh();
			} finally {
				setPending(null);
			}
		},
		[request, onRefresh]
	);

	const deleteAgent = useCallback(
		async (slug: string) => {
			setPending(slug);
			try {
				await request('os.hello.agents.delete', { slug });
				onRefresh();
			} finally {
				setPending(null);
			}
		},
		[request, onRefresh]
	);

	return { startAgent, stopAgent, deleteAgent, pending };
}
