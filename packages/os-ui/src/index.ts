// App component props type
export type { AppComponentProps } from '@/components/apps/app-registry';

// UI Components — re-export from OS host

// OS Primitives
export * from '@/components/os-primitives';
// shadcn/ui components
export * from '@/components/ui/badge';
export * from '@/components/ui/button';
export * from '@/components/ui/ContextMenu';
export * from '@/components/ui/collapsible';
export * from '@/components/ui/command';
export * from '@/components/ui/dropdown-menu';
export * from '@/components/ui/input';
export * from '@/components/ui/note';
export * from '@/components/ui/select';
export * from '@/components/ui/separator';
export * from '@/components/ui/slider';
export * from '@/components/ui/spinner';
export * from '@/components/ui/switch';
export * from '@/components/ui/tabs';
export * from '@/components/ui/theme-provider';
export * from '@/components/ui/theme-switcher';
export * from '@/components/ui/tooltip';
// Auth
export { useOSAuth } from '@/lib/auth/use-auth';
export { useNats, useNatsSubscription } from '@/lib/hooks/use-nats';
export { SUBJECTS } from '@/lib/subjects';
export { cn } from '@/lib/utils';
// Stores (OS-level state)
export { useNotificationStore } from '@/stores/notification-store';
export { useThemeStore } from '@/stores/theme-store';
