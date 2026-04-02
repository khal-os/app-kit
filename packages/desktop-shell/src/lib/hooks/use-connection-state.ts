import { getNatsClient } from '@khal-os/sdk/app';
import { useEffect, useState } from 'react';

/**
 * React hook that tracks the NatsClient connection state.
 *
 * Returns richer state than `useNats().connected` -- distinguishes between
 * reconnecting, auth_expired, version_mismatch, etc.
 */
export function useConnectionState() {
	const [state, setState] = useState<string>('connected');
	const [detail, setDetail] = useState<Record<string, unknown> | undefined>(undefined);

	useEffect(() => {
		const client = getNatsClient();

		// Set initial state from the client
		setState(client.connectionState);

		const unsub = client.onConnectionStateChange((newState, newDetail) => {
			setState(newState);
			setDetail(newDetail);
		});

		return unsub;
	}, []);

	return { state, detail };
}
