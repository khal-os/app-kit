// App component props type
export interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

// Auth — re-export from SDK
export { SUBJECTS, useKhalAuth, useKhalAuth as useOSAuth, useNats, useNatsSubscription } from '@khal-os/sdk/app';
// shadcn/ui components — local implementations
export * from './components/avatar';
export * from './components/badge';
export * from './components/button';
export * from './components/ContextMenu';
export * from './components/command';
// Design system components — local implementations
export * from './components/cost-counter';
export * from './components/dropdown-menu';
export * from './components/glass-card';
export * from './components/input';
export * from './components/khal-logo';
export * from './components/live-feed';
export * from './components/mesh-gradient';
export * from './components/note';
export * from './components/number-flow';
export * from './components/progress-bar';
export * from './components/separator';
export * from './components/spinner';
export * from './components/status-dot';
export * from './components/switch';
export * from './components/theme-provider';
export * from './components/theme-switcher';
export * from './components/ticker-bar';
export * from './components/tooltip';
export { useWindowMinimized, WindowMinimizedProvider } from './components/window-minimized-context';
// Hooks
export { useReducedMotion } from './hooks/useReducedMotion';
// Animations
export { fadeIn, fadeUp, khalEasing, scaleUp, springConfig, staggerChild, staggerContainer } from './lib/animations';
// OS Primitives — local implementations
export * from './primitives';
export type { DesktopNotification, DesktopNotifMode, NotificationUrgency, TrayIcon } from './stores/notification-store';
// Stores (OS-level state)
export { useNotificationStore } from './stores/notification-store';
export { useThemeStore } from './stores/theme-store';
// LP Design Tokens
export * from './tokens/lp-tokens';
// Utilities
export { cn } from './utils';
