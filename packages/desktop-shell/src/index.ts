// -- Main shell orchestrator --

// -- App icon --
export { AppIcon, AppIconWithFallback } from './components/app-icon';
export { CommandPalette } from './components/CommandPalette';
export { ConnectionBanner } from './components/ConnectionBanner';
// -- Desktop chrome components --
// -- Marketplace --
export { MarketplaceView } from './components/marketplace/MarketplaceView';
export { AppCard } from './components/marketplace/AppCard';
export type { StoreEntry } from './components/marketplace/AppCard';
export { Desktop } from './components/Desktop';
export { DesktopBackground } from './components/DesktopBackground';
export { DesktopIcon } from './components/DesktopIcon';
export { DesktopShell } from './components/DesktopShell';
export { MeshGradientBackground } from './components/MeshGradientBackground';
// -- Notifications --
export { NotificationCenter } from './components/notifications/NotificationCenter';
export { NotificationToasts } from './components/notifications/NotificationToasts';
export { OrphanSessionToast } from './components/notifications/OrphanSessionToast';
export { ShortcutViewer } from './components/ShortcutViewer';
export { AppLauncher } from './components/taskbar/AppLauncher';
export { RunningApps } from './components/taskbar/RunningApps';
export { SystemTray } from './components/taskbar/SystemTray';

// -- Taskbar --
export { Taskbar } from './components/taskbar/Taskbar';
export { UserMenu } from './components/taskbar/UserMenu';
export { WorkspaceSwitcher } from './components/taskbar/WorkspaceSwitcher';
export { KMenu } from './components/topbar/KMenu';
export { TabContextMenu } from './components/topbar/TabContextMenu';
export { TabPill } from './components/topbar/TabPill';
// -- TopBar --
export { TOPBAR_HEIGHT, TopBar } from './components/topbar/TopBar';
export type { AppComponentRenderer } from './components/WindowRenderer';
export { setAppRenderer, WindowRenderer } from './components/WindowRenderer';
export { WindowSwitcher } from './components/WindowSwitcher';
export { AppErrorBoundary } from './components/window/AppErrorBoundary';
export { AppWindowTabs } from './components/window/AppWindowTabs';
export { MobileWindowStack } from './components/window/MobileWindowStack';
export { SnapPreview } from './components/window/SnapPreview';
export { TrafficLights } from './components/window/TrafficLights';
// -- Window system --
export { Window } from './components/window/Window';
export { WindowContent } from './components/window/WindowContent';
export { WindowControlsOverlay } from './components/window/WindowControlsOverlay';
export { WindowFrame } from './components/window/WindowFrame';
export { WindowsControls } from './components/window/WindowsControls';
export type { AppManifestInfo } from './components/window/AppSettingsPanel';
export { AppSettingsPanel } from './components/window/AppSettingsPanel';
// -- Pack loader --
export type { PackModule } from './loader';
export { loadPack, PackLoadError } from './loader';
// -- Hooks --
export { useDesktopNats } from './hooks/useDesktopNats';
export { useGlobalKeybinds } from './hooks/useGlobalKeybinds';
export { getAppId, hasAppPermission, useLaunchApp } from './hooks/useLaunchApp';
export { useNatsNotifications } from './hooks/useNatsNotifications';
// -- Lib / utilities --
export { TASKBAR_HEIGHT } from './lib/constants';
export { useConnectionState } from './lib/hooks/use-connection-state';
export { useIsMobile } from './lib/hooks/use-is-mobile';
export { useVisualViewport } from './lib/hooks/use-visual-viewport';
export { DEFAULT_SHORTCUTS } from './lib/keyboard/defaults';
export type { KeyCombo, ModifierKey, ShortcutCategory, ShortcutDefinition } from './lib/keyboard/types';
// -- Keyboard --
export { comboToSymbols, matchesCombo } from './lib/keyboard/types';
export type { Platform } from './lib/platform';
export { getPlatform, usePlatform } from './lib/platform';
// -- Stores --
export type { InstalledAppRow } from './stores/desktop-store';
export { useDesktopStore, useFilteredDesktopApps } from './stores/desktop-store';
export { useKeybindStore } from './stores/keybind-store';
export type { DesktopTab } from './stores/tab-store';
export { useTabStore } from './stores/tab-store';
export { useWindowStore } from './stores/window-store';
export type { DesktopEntry } from './types/desktop-entry';
// -- Types --
export type { SnapZone, WindowPosition, WindowSize, WindowState } from './types/window';
