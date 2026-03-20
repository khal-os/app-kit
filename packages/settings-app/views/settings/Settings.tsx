'use client';

import { Bell, Command, Info, Monitor, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, PropertyPanel, SectionHeader, SidebarNav, SplitPane, StatusBar } from '@/components/os-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Note } from '@/components/ui/note';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/switch';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { useNats } from '@/lib/hooks/use-nats';
import type { KeyCombo, ModifierKey, ShortcutCategory } from '@/lib/keyboard/types';
import { comboToSymbols } from '@/lib/keyboard/types';
import { SUBJECTS } from '@/lib/subjects';
import { useKeybindStore } from '@/stores/keybind-store';
import type { DesktopNotifMode } from '@/stores/notification-store';
import { useNotificationStore } from '@/stores/notification-store';
import type { ThemeConcept } from '@/stores/theme-store';
import { useThemeStore } from '@/stores/theme-store';

const IS_DEV = process.env.NODE_ENV === 'development';

type SettingsTab = 'appearance' | 'notifications' | 'keyboard' | 'about' | 'nats';

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType; devOnly?: boolean }> = [
	{ id: 'appearance', label: 'Appearance', icon: Monitor },
	{ id: 'notifications', label: 'Notifications', icon: Bell },
	{ id: 'keyboard', label: 'Keyboard Shortcuts', icon: Command },
	{ id: 'about', label: 'About', icon: Info },
	{ id: 'nats', label: 'NATS Echo Test', icon: Radio, devOnly: true },
];

export function Settings(_props: { windowId: string; meta?: Record<string, unknown> }) {
	const [tab, setTab] = useState<SettingsTab>('appearance');

	return (
		<div className="flex h-full flex-col bg-background-100">
			<div className="flex-1 overflow-hidden">
				<SplitPane defaultSize={160} min={130} max={220} collapseBelow={400}>
					<SplitPane.Panel className="bg-gray-alpha-50">
						<SidebarNav label="Settings" title="Settings">
							{NAV_ITEMS.filter((item) => !item.devOnly || IS_DEV).map((item) => {
								const Icon = item.icon;
								return (
									<SidebarNav.Item
										key={item.id}
										active={tab === item.id}
										onClick={() => setTab(item.id)}
										icon={<Icon />}
									>
										{item.label}
									</SidebarNav.Item>
								);
							})}
						</SidebarNav>
					</SplitPane.Panel>
					<SplitPane.Panel className="overflow-auto p-6">
						{tab === 'appearance' && <AppearanceTab />}
						{tab === 'notifications' && <NotificationsTab />}
						{tab === 'keyboard' && <KeyboardShortcutsTab />}
						{tab === 'about' && <AboutTab />}
						{tab === 'nats' && <NatsEchoTab />}
					</SplitPane.Panel>
				</SplitPane>
			</div>
			<StatusBar>
				<StatusBar.Item>Genie OS</StatusBar.Item>
				<StatusBar.Spacer />
				<StatusBar.Item variant="success">local</StatusBar.Item>
			</StatusBar>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Theme Concept Picker
// ---------------------------------------------------------------------------

const CONCEPT_OPTIONS: Array<{
	id: ThemeConcept;
	name: string;
	description: string;
	colors: string[];
}> = [
	{
		id: 'glass-office',
		name: 'Glass Office',
		description: 'Heavy frosted glass, translucent surfaces, indigo glow',
		colors: ['#4F46E5', '#818CF8', '#E0E7FF'],
	},
	{
		id: 'slate',
		name: 'Slate',
		description: 'Zero glass, opaque surfaces, violet accent',
		colors: ['#7C3AED', '#A78BFA', '#EDE9FE'],
	},
	{
		id: 'prism',
		name: 'Prism',
		description: 'Dual accent: gold + teal, warm surfaces',
		colors: ['#CA8A04', '#0D9488', '#FEF3C7'],
	},
	{
		id: 'midnight',
		name: 'Midnight',
		description: 'Aurora glow, cyan + magenta neon',
		colors: ['#06B6D4', '#8B5CF6', '#EC4899'],
	},
	{
		id: 'terminal',
		name: 'Terminal',
		description: 'Retro green-on-black, razor-sharp',
		colors: ['#00FF41', '#22C55E', '#0a0a0a'],
	},
	{
		id: 'rose',
		name: 'Ros\u00e9',
		description: 'Soft blush, rose gold warmth',
		colors: ['#E11D48', '#FB7185', '#FFF1F2'],
	},
	{
		id: 'omni',
		name: 'Omni',
		description: 'Heavy glass, violet glow, dark-first',
		colors: ['#9333EA', '#A855F7', '#E9D5FF'],
	},
];

function ConceptPicker() {
	const concept = useThemeStore((s) => s.concept);
	const setConcept = useThemeStore((s) => s.setConcept);

	return (
		<div className="flex flex-col gap-3">
			{CONCEPT_OPTIONS.map((opt) => (
				<button
					key={opt.id}
					onClick={() => setConcept(opt.id)}
					className={`flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors ${
						concept === opt.id
							? 'border-blue-400 bg-blue-100'
							: 'border-gray-alpha-200 bg-background-100 hover:border-gray-alpha-300'
					}`}
				>
					{/* Color swatch preview */}
					<div className="flex h-8 w-12 shrink-0 overflow-hidden rounded-md">
						{opt.colors.map((color) => (
							<div key={color} className="flex-1" style={{ background: color }} />
						))}
					</div>

					<div className="min-w-0 flex-1">
						<p className="text-copy-13 font-medium text-gray-1000">{opt.name}</p>
						<p className="text-copy-12 text-gray-800">{opt.description}</p>
					</div>

					{/* Selection indicator */}
					<div
						className={`h-3 w-3 shrink-0 rounded-full border-2 ${
							concept === opt.id ? 'border-blue-600 bg-blue-600' : 'border-gray-alpha-400'
						}`}
					/>
				</button>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Appearance Tab
// ---------------------------------------------------------------------------

function ReduceMotionToggle() {
	const reduceMotion = useThemeStore((s) => s.reduceMotion);
	const setReduceMotion = useThemeStore((s) => s.setReduceMotion);

	return (
		<div className="flex items-center justify-between rounded-lg border border-gray-alpha-200 bg-background-100 px-4 py-3">
			<div>
				<p className="text-copy-13 font-medium text-gray-1000">Reduce motion</p>
				<p className="text-copy-12 text-gray-800">
					{reduceMotion ? 'Animations are disabled' : 'Animations are enabled'}
				</p>
			</div>
			<Toggle checked={reduceMotion} onChange={() => setReduceMotion(!reduceMotion)} />
		</div>
	);
}

function AppearanceTab() {
	return (
		<div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
			<section>
				<SectionHeader title="Theme Concept" description="Choose a visual style for the OS." />
				<ConceptPicker />
			</section>

			<Separator />

			<section>
				<SectionHeader title="Mode" description="Choose light, dark, or system." />
				<ThemeSwitcher />
			</section>

			<Separator />

			<section>
				<SectionHeader title="Motion" description="Control animation preferences." />
				<ReduceMotionToggle />
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Notifications Tab
// ---------------------------------------------------------------------------

const NOTIF_MODE_OPTIONS: Array<{
	value: DesktopNotifMode;
	label: string;
	description: string;
}> = [
	{ value: 'background', label: 'When in background', description: 'Only show when the tab is not visible' },
	{ value: 'always', label: 'Always', description: 'Show for every notification' },
	{ value: 'off', label: 'Off', description: 'Never send browser notifications' },
];

function NotificationsTab() {
	const doNotDisturb = useNotificationStore((s) => s.doNotDisturb);
	const setDoNotDisturb = useNotificationStore((s) => s.setDoNotDisturb);
	const desktopNotifMode = useNotificationStore((s) => s.desktopNotifMode);
	const setDesktopNotifMode = useNotificationStore((s) => s.setDesktopNotifMode);
	const browserPermission = useNotificationStore((s) => s.browserPermission);
	const requestBrowserPermission = useNotificationStore((s) => s.requestBrowserPermission);
	const syncBrowserPermission = useNotificationStore((s) => s.syncBrowserPermission);
	const history = useNotificationStore((s) => s.history);
	const clearHistory = useNotificationStore((s) => s.clearHistory);

	useEffect(() => {
		syncBrowserPermission();
	}, [syncBrowserPermission]);

	const needsPermission = browserPermission !== 'granted' && desktopNotifMode !== 'off';

	return (
		<div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
			<section>
				<SectionHeader title="Do Not Disturb" description="Suppress in-app toast notifications." />
				<div className="flex items-center justify-between rounded-lg border border-gray-alpha-200 bg-background-100 px-4 py-3">
					<div>
						<p className="text-copy-13 font-medium text-gray-1000">Do Not Disturb</p>
						<p className="text-copy-12 text-gray-800">
							{doNotDisturb ? 'Toasts are hidden' : 'Toasts are shown normally'}
						</p>
					</div>
					<Toggle checked={doNotDisturb} onChange={() => setDoNotDisturb(!doNotDisturb)} />
				</div>
			</section>

			<Separator />

			<section>
				<SectionHeader title="Desktop Notifications" description="Bridge notifications to your OS." />
				<div className="flex flex-col gap-3">
					{NOTIF_MODE_OPTIONS.map((opt) => (
						<button
							key={opt.value}
							onClick={() => setDesktopNotifMode(opt.value)}
							className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
								desktopNotifMode === opt.value
									? 'border-blue-400 bg-blue-100'
									: 'border-gray-alpha-200 bg-background-100 hover:border-gray-alpha-300'
							}`}
						>
							<div
								className={`h-3 w-3 shrink-0 rounded-full border-2 ${desktopNotifMode === opt.value ? 'border-blue-600 bg-blue-600' : 'border-gray-alpha-400'}`}
							/>
							<div>
								<p className="text-copy-13 font-medium text-gray-1000">{opt.label}</p>
								<p className="text-copy-12 text-gray-800">{opt.description}</p>
							</div>
						</button>
					))}
					{needsPermission && (
						<Note type="warning" size="small">
							<div className="flex items-center justify-between gap-4">
								<span>{browserPermission === 'denied' ? 'Blocked by browser.' : 'Permission required.'}</span>
								{browserPermission !== 'denied' && (
									<Button size="small" variant="secondary" onClick={() => requestBrowserPermission()}>
										Allow
									</Button>
								)}
							</div>
						</Note>
					)}
				</div>
			</section>

			<Separator />

			<section>
				<SectionHeader
					title="Notification History"
					description={`${history.length} notification${history.length !== 1 ? 's' : ''}`}
				>
					{history.length > 0 && (
						<Button size="small" variant="secondary" onClick={clearHistory}>
							Clear History
						</Button>
					)}
				</SectionHeader>
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// About Tab
// ---------------------------------------------------------------------------

function AboutTab() {
	return (
		<div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
			<section>
				<SectionHeader title="Genie OS" description="Desktop-in-browser OS shell." />
				<PropertyPanel className="rounded-lg border border-gray-alpha-200">
					<PropertyPanel.Section>
						<PropertyPanel.Row label="Version">v2-dev</PropertyPanel.Row>
						<PropertyPanel.Row label="Framework">Next.js</PropertyPanel.Row>
						<PropertyPanel.Row label="Runtime">
							{typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').pop() : '--'}
						</PropertyPanel.Row>
					</PropertyPanel.Section>
				</PropertyPanel>
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// NATS Echo Test Tab (dev only)
// ---------------------------------------------------------------------------

function NatsEchoTab() {
	const { connected, request } = useNats();
	const [message, setMessage] = useState('');
	const [response, setResponse] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSendEcho = async () => {
		if (!message.trim()) return;
		setLoading(true);
		setError(null);
		setResponse(null);
		try {
			const reply = await request(SUBJECTS.echo(), { message });
			setResponse(JSON.stringify(reply, null, 2));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
			<section>
				<SectionHeader title="NATS Echo Test" description="Send a message to the echo service and see the response.">
					<span
						className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-copy-12 font-medium ${
							connected ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
						}`}
					>
						<span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-600' : 'bg-red-600'}`} />
						{connected ? 'Connected' : 'Disconnected'}
					</span>
				</SectionHeader>

				<div className="flex flex-col gap-4">
					<div className="flex gap-2">
						<Input
							size="small"
							placeholder="Type a message..."
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleSendEcho();
							}}
							aria-label="Echo message"
						/>
						<Button size="small" variant="secondary" onClick={handleSendEcho} disabled={loading || !connected}>
							{loading ? 'Sending...' : 'Send Echo'}
						</Button>
					</div>

					{error && (
						<Note type="error" size="small">
							{error}
						</Note>
					)}

					{response && (
						<div className="rounded-lg border border-gray-alpha-200 bg-background-100 p-4">
							<p className="mb-2 text-copy-12 font-medium text-gray-800">Response:</p>
							<pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-copy-13 text-gray-1000">
								{response}
							</pre>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Tab
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
	window: 'Window Management',
	workspace: 'Workspaces',
	launcher: 'App Launcher',
	terminal: 'Terminal',
	system: 'System',
};

const CATEGORY_ORDER: ShortcutCategory[] = ['window', 'launcher', 'terminal', 'system'];

function ShortcutRecorder({
	value,
	onChange,
	onReset,
	isDefault,
}: {
	value: KeyCombo | null;
	onChange: (combo: KeyCombo) => void;
	onReset: () => void;
	isDefault: boolean;
}) {
	const [recording, setRecording] = useState(false);
	const setSuspended = useKeybindStore((s) => s.setSuspended);

	useEffect(() => {
		if (!recording) {
			setSuspended(false);
			return;
		}
		setSuspended(true);

		const handler = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.key === 'Escape') {
				setRecording(false);
				return;
			}
			if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;
			const modifiers: ModifierKey[] = [];
			if (e.metaKey) modifiers.push('meta');
			if (e.ctrlKey) modifiers.push('ctrl');
			if (e.altKey) modifiers.push('alt');
			if (e.shiftKey) modifiers.push('shift');
			onChange({ key: e.key, modifiers });
			setRecording(false);
		};
		const handleBlur = () => setRecording(false);
		window.addEventListener('keydown', handler, { capture: true });
		window.addEventListener('blur', handleBlur);
		return () => {
			window.removeEventListener('keydown', handler, { capture: true });
			window.removeEventListener('blur', handleBlur);
			setSuspended(false);
		};
	}, [recording, onChange, setSuspended]);

	if (recording) {
		return (
			<div className="flex items-center gap-2">
				<span className="animate-pulse rounded border border-blue-400 bg-blue-100 px-2 py-0.5 text-copy-13 text-blue-900">
					Press a key combo...
				</span>
				<button className="text-copy-12 text-gray-700 hover:text-gray-1000" onClick={() => setRecording(false)}>
					Cancel
				</button>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<button
				className="rounded border border-gray-alpha-300 bg-background-100 px-2 py-0.5 font-mono text-copy-13 text-gray-1000 transition-colors hover:border-gray-alpha-400 hover:bg-gray-alpha-100"
				onClick={() => setRecording(true)}
				title="Click to rebind"
			>
				{value ? comboToSymbols(value) : <span className="text-gray-600">Disabled</span>}
			</button>
			{!isDefault && (
				<button className="text-copy-12 text-gray-700 hover:text-gray-1000" onClick={onReset} title="Reset to default">
					Reset
				</button>
			)}
		</div>
	);
}

function KeyboardShortcutsTab() {
	const definitions = useKeybindStore((s) => s.definitions);
	const overrides = useKeybindStore((s) => s.overrides);
	const getBinding = useKeybindStore((s) => s.getBinding);
	const setBinding = useKeybindStore((s) => s.setBinding);
	const resetBinding = useKeybindStore((s) => s.resetBinding);
	const resetAll = useKeybindStore((s) => s.resetAll);
	const [search, setSearch] = useState('');

	const hasOverrides = Object.keys(overrides).length > 0;
	const filtered = search.trim()
		? definitions.filter(
				(d) =>
					d.label.toLowerCase().includes(search.toLowerCase()) ||
					d.description.toLowerCase().includes(search.toLowerCase())
			)
		: definitions;

	const grouped = CATEGORY_ORDER.map((cat) => ({
		category: cat,
		label: CATEGORY_LABELS[cat],
		shortcuts: filtered.filter((d) => d.category === cat),
	})).filter((g) => g.shortcuts.length > 0);

	return (
		<div className="flex max-w-2xl flex-col gap-6 text-gray-1000">
			<section>
				<SectionHeader title="Keyboard Shortcuts" description="Customize keybindings. Click a shortcut to rebind it.">
					{hasOverrides && (
						<Button
							size="small"
							variant="secondary"
							onClick={() => {
								if (globalThis.confirm('Reset all shortcuts to defaults?')) resetAll();
							}}
						>
							Reset All
						</Button>
					)}
				</SectionHeader>
				<Input
					size="small"
					placeholder="Search shortcuts..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					aria-label="Search keyboard shortcuts"
				/>
			</section>

			{grouped.map((group) => (
				<section key={group.category}>
					<h3 className="mb-2 text-copy-13 font-medium text-gray-900">{group.label}</h3>
					<div className="rounded-lg border border-gray-alpha-200 bg-background-100">
						{group.shortcuts.map((def, i) => {
							const binding = getBinding(def.id);
							const isDefault = !(def.id in overrides);
							return (
								<div
									key={def.id}
									className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? 'border-t border-gray-alpha-100' : ''}`}
								>
									<div className="min-w-0 flex-1">
										<p className="text-copy-13 text-gray-1000">{def.label}</p>
										<p className="text-copy-12 text-gray-700">{def.description}</p>
									</div>
									<ShortcutRecorder
										value={binding}
										onChange={(combo) => setBinding(def.id, combo)}
										onReset={() => resetBinding(def.id)}
										isDefault={isDefault}
									/>
								</div>
							);
						})}
					</div>
				</section>
			))}

			{grouped.length === 0 && search && (
				<EmptyState title="No matching shortcuts" description={`No shortcuts match "${search}".`} compact />
			)}
		</div>
	);
}
