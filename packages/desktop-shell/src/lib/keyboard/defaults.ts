import type { ShortcutDefinition } from './types';

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
	// -- Window Management --
	{
		id: 'window.cycle-next',
		label: 'Switch Window',
		description: 'Cycle to next window (Alt-Tab)',
		category: 'window',
		defaultBinding: { key: 'Tab', modifiers: ['alt'] },
		repeat: true,
	},
	{
		id: 'window.cycle-next-meta',
		label: 'Switch Window (Cmd+Tab)',
		description: 'Cycle to next window with Cmd+Tab',
		category: 'window',
		defaultBinding: { key: 'Tab', modifiers: ['meta'] },
		repeat: true,
	},
	{
		id: 'window.cycle-prev',
		label: 'Switch Window (Reverse)',
		description: 'Cycle to previous window',
		category: 'window',
		defaultBinding: { key: 'Tab', modifiers: ['alt', 'shift'] },
		repeat: true,
	},
	{
		id: 'window.cycle-prev-meta',
		label: 'Switch Window Reverse (Cmd+Shift+Tab)',
		description: 'Cycle to previous window with Cmd+Shift+Tab',
		category: 'window',
		defaultBinding: { key: 'Tab', modifiers: ['meta', 'shift'] },
		repeat: true,
	},
	{
		id: 'window.close',
		label: 'Close Window',
		description: 'Close the focused window',
		category: 'window',
		defaultBinding: { key: 'w', modifiers: ['alt'] },
	},
	{
		id: 'window.minimize',
		label: 'Minimize Window',
		description: 'Minimize the focused window',
		category: 'window',
		defaultBinding: { key: 'h', modifiers: ['meta'] },
	},
	{
		id: 'window.maximize',
		label: 'Maximize / Restore Window',
		description: 'Toggle maximize on the focused window',
		category: 'window',
		defaultBinding: { key: 'ArrowUp', modifiers: ['meta'] },
	},
	{
		id: 'window.snap-left',
		label: 'Tile Window Left',
		description: 'Snap the focused window to the left half',
		category: 'window',
		defaultBinding: { key: 'ArrowLeft', modifiers: ['meta'] },
	},
	{
		id: 'window.snap-right',
		label: 'Tile Window Right',
		description: 'Snap the focused window to the right half',
		category: 'window',
		defaultBinding: { key: 'ArrowRight', modifiers: ['meta'] },
	},

	// -- Launcher --
	{
		id: 'launcher.open',
		label: 'App Launcher',
		description: 'Open the application launcher',
		category: 'launcher',
		defaultBinding: { key: 'k', modifiers: ['meta'] },
	},
	{
		id: 'launcher.terminal',
		label: 'Open Terminal',
		description: 'Open a new terminal window',
		category: 'launcher',
		defaultBinding: { key: 't', modifiers: ['ctrl', 'alt'] },
	},
	{
		id: 'launcher.settings',
		label: 'Open Settings',
		description: 'Open the settings panel',
		category: 'launcher',
		defaultBinding: { key: ',', modifiers: ['meta'] },
	},

	// -- System --
	{
		id: 'system.notification-center',
		label: 'Notification Center',
		description: 'Toggle the notification center',
		category: 'system',
		defaultBinding: { key: 'n', modifiers: ['meta'] },
	},
	{
		id: 'system.shortcut-viewer',
		label: 'Shortcut Viewer',
		description: 'Open the keyboard shortcut reference',
		category: 'system',
		defaultBinding: { key: '/', modifiers: ['meta'] },
	},
	{
		id: 'window.close-meta',
		label: 'Close Window/Tab',
		description: 'Close window or terminal tab (context-aware)',
		category: 'window',
		defaultBinding: { key: 'w', modifiers: ['meta'] },
	},

	// -- Terminal --
	{
		id: 'terminal.new-tab',
		label: 'New Terminal Tab',
		description: 'Create a new tab in the terminal',
		category: 'terminal',
		defaultBinding: { key: 't', modifiers: ['meta'] },
	},
	{
		id: 'terminal.close-tab',
		label: 'Close Terminal Tab/Pane',
		description: 'Close the active terminal tab or pane',
		category: 'terminal',
		defaultBinding: { key: 'w', modifiers: ['meta'] },
	},
	{
		id: 'terminal.next-tab',
		label: 'Next Terminal Tab',
		description: 'Switch to the next terminal tab',
		category: 'terminal',
		defaultBinding: { key: 'Tab', modifiers: ['ctrl'] },
	},
	{
		id: 'terminal.prev-tab',
		label: 'Previous Terminal Tab',
		description: 'Switch to the previous terminal tab',
		category: 'terminal',
		defaultBinding: { key: 'Tab', modifiers: ['ctrl', 'shift'] },
	},
	{
		id: 'terminal.split-vertical',
		label: 'Split Terminal Vertically',
		description: 'Split the active pane into two side-by-side panes',
		category: 'terminal',
		defaultBinding: { key: 'd', modifiers: ['meta'] },
	},
	{
		id: 'terminal.split-horizontal',
		label: 'Split Terminal Horizontally',
		description: 'Split the active pane into two top/bottom panes',
		category: 'terminal',
		defaultBinding: { key: 'd', modifiers: ['meta', 'shift'] },
	},
];
