import { SUBJECTS, useKhalAuth, useNats } from '@khal-os/sdk/app';
import { useNotificationStore } from '@khal-os/ui';
import { useEffect, useRef } from 'react';
import { claimCommand, deriveCommandId } from '../lib/desktop/dedup';
import type { DesktopCmdNotify, DesktopCmdOpen, DesktopCmdWindow } from '../lib/desktop/schema';
import { useWindowStore } from '../stores/window-store';
import type { WindowState } from '../types/window';

/**
 * NOTE: The original useDesktopNats depends on app-manifest/getManifestEntry (core-specific)
 * for handleCmdOpen. In the desktop-shell package, we provide a simplified version that
 * handles the NATS bridge for window commands without the manifest dependency.
 * Consumers (core) can extend this behavior via the manifest integration.
 */

let nextDesktopNotifId = 200_000;

function parseJson(data: unknown): Record<string, unknown> | null {
	let obj = data;
	if (typeof obj === 'string') {
		try {
			obj = JSON.parse(obj);
		} catch {
			return null;
		}
	}
	if (typeof obj !== 'object' || obj === null) return null;
	return obj as Record<string, unknown>;
}

function windowEventPayload(win: WindowState) {
	return {
		windowId: win.id,
		appId: win.appId,
		title: win.title,
		x: win.position.x,
		y: win.position.y,
		width: win.size.width,
		height: win.size.height,
		meta: win.meta,
	};
}

// -- Command handlers --

function handleCmdOpen(payload: Record<string, unknown> | null, cmdId: string) {
	if (!payload) return;
	const p = payload as unknown as DesktopCmdOpen;
	if (!p.appId) return;

	// Deterministic window ID from cmdId
	const windowId = `cmd-${cmdId}`;
	const store = useWindowStore.getState();
	if (store.getWindows().some((w) => w.id === windowId)) return;

	store.openWindow({
		id: windowId,
		title: p.title ?? p.appId,
		appId: p.appId,
		width: p.width ?? 800,
		height: p.height ?? 600,
		meta: { ...p.meta, _cmdId: cmdId },
	});
}

function handleCmdWindow(payload: Record<string, unknown> | null, action: (id: string) => void) {
	if (!payload) return;
	const p = payload as unknown as DesktopCmdWindow;
	if (!p.windowId) return;
	action(p.windowId);
}

function handleCmdNotify(payload: Record<string, unknown> | null) {
	if (!payload) return;
	const p = payload as unknown as DesktopCmdNotify;
	if (!p.summary) return;
	useNotificationStore.getState().addNotification({
		id: ++nextDesktopNotifId,
		replacesId: 0,
		summary: p.summary,
		body: p.body ?? '',
		icon: null,
		actions: [],
		expires: 0,
		appName: p.appName,
		urgency: p.urgency,
	});
}

function handleCmdSync(orgId: string, userId: string, publish: (subject: string, data?: unknown) => void) {
	const windows = useWindowStore.getState().getWindows();
	publish(SUBJECTS.desktop.event.state(orgId, userId), {
		windows: windows.map((w) => ({
			id: w.id,
			appId: w.appId,
			title: w.title,
			minimized: w.minimized,
			maximized: w.maximized,
			focused: w.focused,
			position: w.position,
			size: w.size,
			zIndex: w.zIndex,
			meta: w.meta,
		})),
	});
}

// -- Event diffing --

function publishWindowEvents(
	curr: WindowState[],
	prev: WindowState[],
	orgId: string,
	userId: string,
	publish: (subject: string, data?: unknown) => void
) {
	const currMap = new Map(curr.map((w) => [w.id, w]));
	const prevMap = new Map(prev.map((w) => [w.id, w]));

	for (const w of curr) {
		if (!prevMap.has(w.id) && !w.closing) {
			publish(SUBJECTS.desktop.event.opened(orgId, userId), windowEventPayload(w));
		}
	}

	for (const w of prev) {
		if (!currMap.has(w.id)) {
			publish(SUBJECTS.desktop.event.closed(orgId, userId), windowEventPayload(w));
		}
	}

	for (const w of curr) {
		const p = prevMap.get(w.id);
		if (!p) continue;
		publishStateChanges(w, p, orgId, userId, publish);
	}
}

function publishStateChanges(
	w: WindowState,
	p: WindowState,
	orgId: string,
	userId: string,
	publish: (subject: string, data?: unknown) => void
) {
	const ev = windowEventPayload(w);
	if (w.focused && !p.focused) {
		publish(SUBJECTS.desktop.event.focused(orgId, userId), ev);
	}
	if (w.minimized && !p.minimized) {
		publish(SUBJECTS.desktop.event.minimized(orgId, userId), ev);
	}
	if (w.maximized && !p.maximized) {
		publish(SUBJECTS.desktop.event.maximized(orgId, userId), ev);
	}
	if ((!w.minimized && p.minimized) || (!w.maximized && p.maximized)) {
		publish(SUBJECTS.desktop.event.restored(orgId, userId), ev);
	}
	if (w.position.x !== p.position.x || w.position.y !== p.position.y) {
		publish(SUBJECTS.desktop.event.moved(orgId, userId), {
			windowId: w.id,
			x: w.position.x,
			y: w.position.y,
		});
	}
	if (w.size.width !== p.size.width || w.size.height !== p.size.height) {
		publish(SUBJECTS.desktop.event.resized(orgId, userId), {
			windowId: w.id,
			width: w.size.width,
			height: w.size.height,
		});
	}
}

// -- Remote event handling (cross-tab sync) --

type StoreActions = ReturnType<typeof useWindowStore.getState>;

interface RemoteWindow {
	id: string;
	appId: string;
	title: string;
	minimized: boolean;
	maximized: boolean;
	focused: boolean;
	position?: { x: number; y: number };
	size?: { width: number; height: number };
	zIndex?: number;
	meta?: Record<string, unknown>;
}

function handleRemoteOpened(payload: Record<string, unknown>, store: StoreActions) {
	const windowId = payload.windowId as string;
	if (!windowId) return;
	const windows = store.getWindows();

	if (windows.some((w) => w.id === windowId)) return;

	const meta = payload.meta as Record<string, unknown> | undefined;
	const cmdId = meta?._cmdId;
	if (cmdId && windows.some((w) => w.meta?._cmdId === cmdId)) return;

	store.openWindow({
		id: windowId,
		appId: payload.appId as string,
		title: payload.title as string,
		width: (payload.width as number) || undefined,
		height: (payload.height as number) || undefined,
		meta: { ...meta, _awaitingMeta: true },
	});
}

function handleRemoteWindowAction(payload: Record<string, unknown>, action: (id: string) => void) {
	const windowId = payload.windowId as string;
	if (windowId) action(windowId);
}

function applyStateSync(payload: Record<string, unknown>, store: StoreActions) {
	const remoteWindows = (payload.windows ?? []) as RemoteWindow[];
	const localWindows = store.getWindows();
	const localIds = new Set(localWindows.map((w) => w.id));
	const remoteIds = new Set(remoteWindows.map((w) => w.id));

	for (const rw of remoteWindows) {
		if (!localIds.has(rw.id)) {
			store.openWindow({
				id: rw.id,
				appId: rw.appId,
				title: rw.title,
				width: rw.size?.width,
				height: rw.size?.height,
				x: rw.position?.x,
				y: rw.position?.y,
				meta: rw.meta,
			});
		}
	}

	for (const lw of localWindows) {
		if (!remoteIds.has(lw.id)) store.removeWindowImmediate(lw.id);
	}

	reconcileFlags(remoteWindows, localIds, store);
}

function reconcileFlags(remoteWindows: RemoteWindow[], localIds: Set<string>, store: StoreActions) {
	for (const rw of remoteWindows) {
		if (!localIds.has(rw.id)) continue;
		if (rw.focused) store.focusWindow(rw.id);
		if (rw.minimized) store.minimizeWindow(rw.id);
		if (rw.maximized) store.maximizeWindow(rw.id);
		if (rw.position) store.moveWindow(rw.id, rw.position);
		if (rw.size) store.resizeWindow(rw.id, rw.size);
	}
}

function handleRemoteMetaUpdated(payload: Record<string, unknown>, store: StoreActions) {
	const windowId = payload.windowId as string;
	if (!windowId) return;
	const meta = payload.meta as Record<string, unknown> | undefined;
	if (!meta) return;
	meta._awaitingMeta = undefined;
	store.updateWindowMeta(windowId, meta);
}

function handleRemoteEvent(event: string | undefined, payload: Record<string, unknown>, store: StoreActions) {
	switch (event) {
		case 'opened':
			handleRemoteOpened(payload, store);
			break;
		case 'closed':
			handleRemoteWindowAction(payload, store.removeWindowImmediate);
			break;
		case 'focused':
			handleRemoteWindowAction(payload, store.focusWindow);
			break;
		case 'minimized':
			handleRemoteWindowAction(payload, store.minimizeWindow);
			break;
		case 'maximized':
			handleRemoteWindowAction(payload, store.maximizeWindow);
			break;
		case 'restored':
			handleRemoteWindowAction(payload, store.restoreWindow);
			break;
		case 'moved':
			handleRemoteWindowAction(payload, (id) =>
				store.moveWindow(id, { x: payload.x as number, y: payload.y as number })
			);
			break;
		case 'resized':
			handleRemoteWindowAction(payload, (id) =>
				store.resizeWindow(id, { width: payload.width as number, height: payload.height as number })
			);
			break;
		case 'state':
			applyStateSync(payload, store);
			break;
		case 'meta-updated':
			handleRemoteMetaUpdated(payload, store);
			break;
	}
}

/**
 * Bridges NATS commands -> Zustand actions and Zustand state changes -> NATS events.
 * Mount once in DesktopShell.
 */
export function useDesktopNats() {
	const { subscribe, publish, orgId, userId } = useNats();
	const auth = useKhalAuth();
	const _permissions = auth?.permissions ?? [];

	// Suppress event re-publishing when applying remote events
	const syncingRef = useRef(false);

	// Stable refs so the Zustand subscriber doesn't re-attach on every render
	const publishRef = useRef(publish);
	const orgIdRef = useRef(orgId);
	const userIdRef = useRef(userId);
	publishRef.current = publish;
	orgIdRef.current = orgId;
	userIdRef.current = userId;

	// -- Command handling (NATS -> Zustand) --
	useEffect(() => {
		if (!orgId || !userId) return;

		const subject = SUBJECTS.desktop.cmd.all(orgId, userId);
		const store = useWindowStore.getState();

		const unsub = subscribe(subject, (data: unknown, fullSubject: string) => {
			const cmd = fullSubject.split('.').pop();
			const payload = parseJson(data);

			// Dedup: derive or extract cmdId, claim via localStorage
			const rawPayload = typeof data === 'string' ? data : JSON.stringify(data);
			const cmdId =
				((payload as Record<string, unknown> | null)?._cmdId as string) ?? deriveCommandId(fullSubject, rawPayload);
			if (!claimCommand(cmdId)) return;

			switch (cmd) {
				case 'open':
					handleCmdOpen(payload, cmdId);
					break;
				case 'close':
					handleCmdWindow(payload, store.closeWindow);
					break;
				case 'focus':
					handleCmdWindow(payload, store.focusWindow);
					break;
				case 'minimize':
					handleCmdWindow(payload, store.minimizeWindow);
					break;
				case 'maximize':
					handleCmdWindow(payload, store.maximizeWindow);
					break;
				case 'restore':
					handleCmdWindow(payload, store.restoreWindow);
					break;
				case 'notify':
					handleCmdNotify(payload);
					break;
				case 'sync': {
					const org = orgIdRef.current;
					const uid = userIdRef.current;
					if (org && uid) handleCmdSync(org, uid, publishRef.current);
					break;
				}
			}
		});

		return unsub;
	}, [orgId, userId, subscribe]);

	// -- Event publishing (Zustand -> NATS) --
	useEffect(() => {
		if (!orgId || !userId) return;

		const unsub = useWindowStore.subscribe((state, prevState) => {
			if (syncingRef.current) return;
			const org = orgIdRef.current;
			const uid = userIdRef.current;
			if (!org || !uid) return;
			const wsId = state.activeWorkspaceId;
			if (!wsId) return;

			const curr = state.windowsByWorkspace[wsId] ?? [];
			const prev = prevState.windowsByWorkspace[wsId] ?? [];
			publishWindowEvents(curr, prev, org, uid, publishRef.current);
		});

		return unsub;
	}, [orgId, userId]);

	// -- Remote event subscription (cross-tab sync) --
	useEffect(() => {
		if (!orgId || !userId) return;

		const subject = SUBJECTS.desktop.event.all(orgId, userId);
		const store = useWindowStore.getState();

		const unsub = subscribe(subject, (data: unknown, fullSubject: string) => {
			const payload = parseJson(data);
			if (!payload) return;

			syncingRef.current = true;
			try {
				handleRemoteEvent(fullSubject.split('.').pop(), payload, store);
			} finally {
				syncingRef.current = false;
			}
		});

		// Request full state from existing tabs
		publishRef.current(SUBJECTS.desktop.cmd.sync(orgId, userId), {});

		return unsub;
	}, [orgId, userId, subscribe]);
}
