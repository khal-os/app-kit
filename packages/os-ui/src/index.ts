// App component props type
export type { AppComponentProps } from '@/components/apps/app-registry';
// ── Hooks & utilities (re-exported from OS host) ───────────────────────
export { useReducedMotion } from '@/hooks/useReducedMotion';
export { fadeIn, fadeUp, khalEasing, scaleUp, springConfig, staggerChild, staggerContainer } from '@/lib/animations';
export { useKhalAuth, useKhalAuth as useOSAuth } from '@/lib/auth/use-auth';
export { useNats, useNatsSubscription } from '@/lib/hooks/use-nats';
export { SUBJECTS } from '@/lib/subjects';
// ── Stores (OS-level state) ────────────────────────────────────────────
export { useNotificationStore } from '@/stores/notification-store';
export { useThemeStore } from '@/stores/theme-store';
// ── UI Components (local) ──────────────────────────────────────────────
export * from './components/avatar';
export * from './components/badge';
export * from './components/button';
export * from './components/ContextMenu';
export * from './components/command';
export * from './components/cost-counter';
export * from './components/dropdown-menu';
export * from './components/glass-card';
export * from './components/input';
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
// ── OS Primitives (local) ──────────────────────────────────────────────
export * from './primitives';
// ── Utilities (local) ──────────────────────────────────────────────────
export { cn } from './utils';
