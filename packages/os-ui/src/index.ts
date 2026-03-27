// App component props type
export type { AppComponentProps } from '@/components/apps/app-registry';

// UI Components — re-export from OS host

// Auth — re-export from SDK
export { SUBJECTS, useKhalAuth, useKhalAuth as useOSAuth, useNats, useNatsSubscription } from '@khal-os/sdk/app';
// OS Primitives
export * from '@/components/os-primitives';
export * from '@/components/ui/avatar';
// shadcn/ui components
export * from '@/components/ui/badge';
export * from '@/components/ui/button';
export * from '@/components/ui/ContextMenu';
export * from '@/components/ui/command';
// Design system components
export * from '@/components/ui/cost-counter';
export * from '@/components/ui/dropdown-menu';
export * from '@/components/ui/glass-card';
export * from '@/components/ui/input';
export * from '@/components/ui/live-feed';
export * from '@/components/ui/mesh-gradient';
export * from '@/components/ui/note';
export * from '@/components/ui/number-flow';
export * from '@/components/ui/progress-bar';
export * from '@/components/ui/separator';
export * from '@/components/ui/spinner';
export * from '@/components/ui/status-dot';
export * from '@/components/ui/switch';
export * from '@/components/ui/theme-provider';
export * from '@/components/ui/theme-switcher';
export * from '@/components/ui/ticker-bar';
export * from '@/components/ui/tooltip';
export { useReducedMotion } from '@/hooks/useReducedMotion';
// Animations
export { fadeIn, fadeUp, khalEasing, scaleUp, springConfig, staggerChild, staggerContainer } from '@/lib/animations';
export { cn } from '@/lib/utils';
// Stores (OS-level state)
export { useNotificationStore } from '@/stores/notification-store';
export { useThemeStore } from '@/stores/theme-store';
