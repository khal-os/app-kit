import { useKhalAuth } from '@khal-os/sdk/app';
import { useNotificationStore } from '@khal-os/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { matchesCombo } from '../lib/keyboard/types';
import { useKeybindStore } from '../stores/keybind-store';
import { useWindowStore } from '../stores/window-store';
import type { WindowState } from '../types/window';
import { hasAppPermission } from './useLaunchApp';

interface WindowSwitcherState {
	visible: boolean;
	windows: WindowState[];
	selectedIndex: number;
}

export function useGlobalKeybinds() {
	const [switcher, setSwitcher] = useState<WindowSwitcherState>({
		visible: false,
		windows: [],
		selectedIndex: 0,
	});
	const switcherRef = useRef(switcher);
	switcherRef.current = switcher;

	const [launcherToggle, setLauncherToggle] = useState(0);
	const [shortcutViewerVisible, setShortcutViewerVisible] = useState(false);

	// Track permissions via ref so handleAction stays stable (no dep change)
	const auth = useKhalAuth();
	const permissionsRef = useRef<string[]>(auth?.permissions ?? []);
	permissionsRef.current = auth?.permissions ?? [];

	const handleAction = useCallback((id: string) => {
		const windowStore = useWindowStore.getState();

		switch (id) {
			case 'window.cycle-next':
			case 'window.cycle-next-meta':
			case 'window.cycle-prev':
			case 'window.cycle-prev-meta': {
				const windows = windowStore.getWindows();
				if (windows.length === 0) return;
				const sorted = [...windows].sort((a, b) => b.zIndex - a.zIndex);
				const current = switcherRef.current;
				const isNext = id === 'window.cycle-next' || id === 'window.cycle-next-meta';

				if (!current.visible) {
					const startIndex = isNext ? 1 : sorted.length - 1;
					setSwitcher({
						visible: true,
						windows: sorted,
						selectedIndex: Math.min(startIndex, sorted.length - 1),
					});
				} else {
					const dir = isNext ? 1 : -1;
					const next = (current.selectedIndex + dir + current.windows.length) % current.windows.length;
					setSwitcher((prev) => ({ ...prev, selectedIndex: next }));
				}
				return;
			}

			case 'window.close': {
				const top = windowStore.getTopmostWindow();
				if (top) windowStore.closeWindow(top.id);
				return;
			}
			case 'window.close-meta': {
				const top = windowStore.getTopmostWindow();
				// If focused window is terminal, skip (let terminal handle Cmd+W internally as close-tab)
				if (top && top.appId !== 'terminal') {
					windowStore.closeWindow(top.id);
				}
				return;
			}
			case 'window.minimize': {
				const top = windowStore.getTopmostWindow();
				if (top) windowStore.minimizeWindow(top.id);
				return;
			}
			case 'window.maximize': {
				const top = windowStore.getTopmostWindow();
				if (top) {
					if (top.maximized) windowStore.restoreWindow(top.id);
					else windowStore.maximizeWindow(top.id);
				}
				return;
			}
			case 'window.snap-left': {
				const top = windowStore.getTopmostWindow();
				if (top) {
					if (top.snapped === 'left') windowStore.unsnapWindow(top.id);
					else windowStore.snapWindow(top.id, 'left');
				}
				return;
			}
			case 'window.snap-right': {
				const top = windowStore.getTopmostWindow();
				if (top) {
					if (top.snapped === 'right') windowStore.unsnapWindow(top.id);
					else windowStore.snapWindow(top.id, 'right');
				}
				return;
			}

			default: {
				if (id === 'launcher.open') {
					setLauncherToggle((n) => n + 1);
					return;
				}
				if (id === 'launcher.terminal') {
					if (!hasAppPermission('terminal', permissionsRef.current)) {
						useNotificationStore.getState().addNotification({
							id: Date.now(),
							replacesId: 0,
							summary: 'Permission Denied',
							body: 'You do not have permission to open Terminal.',
							icon: null,
							actions: [],
							expires: 4000,
							urgency: 'normal',
						});
						return;
					}
					windowStore.openWindow({ title: 'Terminal', appId: 'terminal', width: 720, height: 480 });
					return;
				}
				if (id === 'launcher.settings') {
					if (!hasAppPermission('settings', permissionsRef.current)) {
						useNotificationStore.getState().addNotification({
							id: Date.now(),
							replacesId: 0,
							summary: 'Permission Denied',
							body: 'You do not have permission to open Settings.',
							icon: null,
							actions: [],
							expires: 4000,
							urgency: 'normal',
						});
						return;
					}
					windowStore.openWindow({ title: 'Settings', appId: 'settings', width: 700, height: 500 });
					return;
				}
				if (id === 'system.notification-center') {
					useNotificationStore.getState().toggleCenter();
					return;
				}
				if (id === 'system.shortcut-viewer') {
					setShortcutViewerVisible((v) => !v);
					return;
				}
			}
		}
	}, []);

	const commitSwitcher = useCallback(() => {
		const current = switcherRef.current;
		if (!current.visible) return;
		const selected = current.windows[current.selectedIndex];
		if (selected) {
			useWindowStore.getState().focusWindow(selected.id);
		}
		setSwitcher({ visible: false, windows: [], selectedIndex: 0 });
	}, []);

	useEffect(() => {
		const store = useKeybindStore.getState();
		const { definitions } = store;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target instanceof HTMLElement && e.target.isContentEditable)
			) {
				return;
			}

			const state = useKeybindStore.getState();
			if (state.suspended) return;
			const { getBinding } = state;
			for (const def of definitions) {
				if (def.onKeyUp) continue;
				const binding = getBinding(def.id);
				if (!binding) continue;
				if (!def.repeat && e.repeat) continue;
				if (matchesCombo(e, binding)) {
					e.preventDefault();
					e.stopPropagation();
					handleAction(def.id);
					return;
				}
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if ((e.key === 'Alt' || e.key === 'Meta') && switcherRef.current.visible) {
				commitSwitcher();
				return;
			}

			const upState = useKeybindStore.getState();
			if (upState.suspended) return;
			const { getBinding } = upState;
			for (const def of definitions) {
				if (!def.onKeyUp) continue;
				const binding = getBinding(def.id);
				if (!binding) continue;
				if (matchesCombo(e, binding)) {
					e.preventDefault();
					handleAction(def.id);
					return;
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown, { capture: true });
		window.addEventListener('keyup', handleKeyUp, { capture: true });
		return () => {
			window.removeEventListener('keydown', handleKeyDown, { capture: true });
			window.removeEventListener('keyup', handleKeyUp, { capture: true });
		};
	}, [handleAction, commitSwitcher]);

	return {
		switcher,
		launcherToggle,
		shortcutViewerVisible,
		setShortcutViewerVisible,
	};
}
