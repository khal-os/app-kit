import { SUBJECTS, useKhalAuth, useNats } from '@khal-os/sdk/app';
import { useNotificationStore } from '@khal-os/ui';
import { useCallback, useEffect, useRef } from 'react';
import type { NatsNotification } from '../lib/notifications/schema';

let nextNatsNotifId = 100_000;

function parseNotification(data: unknown): NatsNotification | null {
	let obj = data;
	// Bridge may deliver payload as a JSON string -- parse it
	if (typeof obj === 'string') {
		try {
			obj = JSON.parse(obj);
		} catch {
			return null;
		}
	}
	if (typeof obj !== 'object' || obj === null) return null;
	const rec = obj as Record<string, unknown>;
	if (typeof rec.summary !== 'string' || rec.summary.length === 0) return null;
	return rec as unknown as NatsNotification;
}

export function useNatsNotifications() {
	const { subscribe, orgId } = useNats();
	const auth = useKhalAuth();
	const userId = auth?.userId ?? '';

	const addNotification = useNotificationStore((s) => s.addNotification);

	const handleMessage = useCallback(
		(data: unknown) => {
			const notif = parseNotification(data);
			if (!notif) {
				// biome-ignore lint/suspicious/noConsole: intentional warning for invalid NATS payloads
				console.warn('[nats-notifications] invalid payload, ignoring:', data);
				return;
			}

			const id = ++nextNatsNotifId;
			addNotification({
				id,
				replacesId: 0,
				summary: notif.summary,
				body: notif.body ?? '',
				icon: notif.icon ?? null,
				actions: [],
				expires: 0,
				appName: notif.appName,
				urgency: notif.urgency,
				category: notif.category,
				transient: notif.transient,
			});
		},
		[addNotification]
	);

	const unsubsRef = useRef<Array<() => void>>([]);

	useEffect(() => {
		if (!orgId) return;

		const unsubs: Array<() => void> = [];

		// Broadcast -- all users in the org
		unsubs.push(subscribe(SUBJECTS.notify.broadcast(orgId), handleMessage));

		// User-specific -- only for the authenticated user
		if (userId) {
			unsubs.push(subscribe(SUBJECTS.notify.user(orgId, userId), handleMessage));
		}

		unsubsRef.current = unsubs;

		return () => {
			for (const unsub of unsubs) unsub();
			unsubsRef.current = [];
		};
	}, [orgId, userId, subscribe, handleMessage]);
}
