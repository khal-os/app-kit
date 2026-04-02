import { useKhalAuth, useNats } from '@khal-os/sdk/app';
import { useEffect, useRef, useState } from 'react';
import { useDesktopNats } from '../hooks/useDesktopNats';
import { useGlobalKeybinds } from '../hooks/useGlobalKeybinds';
import { useNatsNotifications } from '../hooks/useNatsNotifications';
import { useDesktopStore } from '../stores/desktop-store';
import { useTabStore } from '../stores/tab-store';
import { useWindowStore } from '../stores/window-store';
import { CommandPalette } from './CommandPalette';
import { ConnectionBanner } from './ConnectionBanner';
import { Desktop } from './Desktop';
import { DesktopBackground } from './DesktopBackground';
import { NotificationCenter } from './notifications/NotificationCenter';
import { NotificationToasts } from './notifications/NotificationToasts';
import { OrphanSessionToast } from './notifications/OrphanSessionToast';
import { ShortcutViewer } from './ShortcutViewer';
import { Taskbar } from './taskbar/Taskbar';
import { TOPBAR_HEIGHT, TopBar } from './topbar/TopBar';
import { WindowRenderer } from './WindowRenderer';
import { WindowSwitcher } from './WindowSwitcher';

/** Fallback workspace ID for unauthenticated / loading state. */
const LOCAL_WORKSPACE_ID = 'local';

function useDocumentTitle() {
	useEffect(() => {
		document.title = 'khal';
	}, []);
}

interface DesktopShellProps {
	/** Permissions resolved server-side, used as fallback. */
	serverPermissions?: string[];
}

export function DesktopShell({ serverPermissions }: DesktopShellProps) {
	useDocumentTitle();
	useNatsNotifications();
	useDesktopNats();
	const { switcher, launcherToggle, shortcutViewerVisible, setShortcutViewerVisible } = useGlobalKeybinds();

	// Command palette state -- driven by Cmd+K (launcherToggle) and taskbar "k" button
	const [paletteOpen, setPaletteOpen] = useState(false);
	const paletteToggleRef = useRef(launcherToggle);
	useEffect(() => {
		if (launcherToggle !== paletteToggleRef.current) {
			paletteToggleRef.current = launcherToggle;
			setPaletteOpen((prev) => !prev);
		}
	}, [launcherToggle]);

	const auth = useKhalAuth();

	// SSR hydration guard: only render after client-side mount
	const [mounted, setMounted] = useState(false);

	// Bootstrap: set the workspace from auth
	const bootstrappedRef = useRef(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	// Fetch installed apps from PG via NATS once WS is connected
	const fetchApps = useDesktopStore((s) => s.fetchApps);
	const { connected, subscribe } = useNats();
	useEffect(() => {
		if (!mounted || !connected) return;
		fetchApps();
	}, [mounted, connected, fetchApps]);

	// Re-fetch apps when install/uninstall events fire
	useEffect(() => {
		if (!mounted || !connected) return;
		const unsub = subscribe('khal._internal.apps.changed', () => {
			fetchApps();
		});
		return unsub;
	}, [mounted, connected, subscribe, fetchApps]);

	// Set workspace from tab store on mount; migrate legacy local workspace data if needed
	const activeTabId = useTabStore((s) => s.activeTabId);
	useEffect(() => {
		if (!mounted) return;
		if (auth?.loading) return;

		const store = useWindowStore.getState();

		// One-time migration: copy 'local' workspace data into the active tab workspace
		if (!bootstrappedRef.current) {
			const localWindows = store.windowsByWorkspace[LOCAL_WORKSPACE_ID];
			const tabWindows = store.windowsByWorkspace[activeTabId];

			if (localWindows && localWindows.length > 0 && (!tabWindows || tabWindows.length === 0)) {
				store.loadWindowState(activeTabId, localWindows);
			}
			if (localWindows && localWindows.length > 0) {
				store.loadWindowState(LOCAL_WORKSPACE_ID, []);
			}

			// Only sync workspace on first bootstrap -- tab-store handles subsequent switches
			store.setActiveWorkspace(activeTabId);
			bootstrappedRef.current = true;
		}
	}, [mounted, auth?.loading, activeTabId]);

	// Prevent hydration mismatch by not rendering until mounted
	// Also show loading state while auth is resolving
	if (!mounted || auth?.loading) {
		return (
			<div className="h-screen w-screen overflow-hidden">
				<DesktopBackground />
			</div>
		);
	}

	return (
		<div className="h-screen w-screen overflow-hidden">
			<TopBar />
			<ConnectionBanner />
			<DesktopBackground />
			<div style={{ paddingTop: TOPBAR_HEIGHT }}>
				<Desktop serverPermissions={serverPermissions} />
				<WindowRenderer />
			</div>
			<Taskbar onOpenPalette={() => setPaletteOpen(true)} />
			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} serverPermissions={serverPermissions} />
			<NotificationToasts />
			<NotificationCenter />
			<OrphanSessionToast />
			<WindowSwitcher visible={switcher.visible} windows={switcher.windows} selectedIndex={switcher.selectedIndex} />
			<ShortcutViewer visible={shortcutViewerVisible} onClose={() => setShortcutViewerVisible(false)} />
		</div>
	);
}
