// OS Primitives — UI building blocks for desktop app chrome.
// Built on top of shadcn/ui components and Geist design tokens.
//
// These fill the gap between shadcn's web-focused components and the
// needs of a desktop-style app (toolbars, split panes, status bars, etc.).
//
// shadcn/ui components to use directly (from @/components/ui/*):
//   Button, Input, Badge, Spinner, Separator, Tooltip, Toggle (Switch),
//   ContextMenu, Command (CommandDialog), DropdownMenu, Note, LoadingDots,
//   ThemeSwitcher

export { CollapsibleSidebar, useSidebar } from './collapsible-sidebar';
export { Dialog } from './dialog';
export { EmptyState } from './empty-state';
export { ListView } from './list-view';
export { PropertyPanel } from './property-panel';
export { SectionHeader } from './section-header';
export { SidebarNav } from './sidebar-nav';
export { SplitPane } from './split-pane';
export { StatusBadge } from './status-badge';
export { StatusBar } from './status-bar';
export { Toolbar } from './toolbar';
