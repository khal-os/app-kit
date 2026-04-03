'use client';

import { SUBJECTS, useNats } from '@khal-os/sdk/app';
import { type DesktopNotifMode, useNotificationStore, useThemeStore } from '@khal-os/ui';
import { Bell, Command, Info, Monitor, Package, Radio, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, EmptyState, Input, Note, PropertyPanel, SectionHeader, Separator, SidebarNav, SplitPane, StatusBar, ThemeSwitcher, Toggle } from '@khal-os/ui';
import type { KeyCombo, ModifierKey, ShortcutCategory } from '@khal-os/desktop-shell';
import { comboToSymbols, useKeybindStore } from '@khal-os/desktop-shell';

const IS_DEV = process.env.NODE_ENV === 'development';

type SettingsTab = 'appearance' | 'notifications' | 'keyboard' | 'about' | 'nats' | 'services' | 'apps';

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType; devOnly?: boolean }> = [
	{ id: 'appearance', label: 'Appearance', icon: Monitor },
	{ id: 'notifications', label: 'Notifications', icon: Bell },
	{ id: 'keyboard', label: 'Keyboard Shortcuts', icon: Command },
	{ id: 'about', label: 'About', icon: Info },
	{ id: 'nats', label: 'NATS Echo Test', icon: Radio, devOnly: true },
	{ id: 'services', label: 'Services', icon: Server, devOnly: true },
	{ id: 'apps', label: 'Apps', icon: Package },
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
						{tab === 'services' && <ServicesTab />}
						{tab === 'apps' && <AppsTab />}
					</SplitPane.Panel>
				</SplitPane>
			</div>
			<StatusBar>
				<StatusBar.Item>khal</StatusBar.Item>
				<StatusBar.Spacer />
				<StatusBar.Item variant="success">local</StatusBar.Item>
			</StatusBar>
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
				<SectionHeader title="khal" description="Desktop-in-browser OS shell." />
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
	const { connected, request, orgId } = useNats();
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
			const reply = await request(SUBJECTS.echo(orgId), { message });
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
// Services Tab (dev only)
// ---------------------------------------------------------------------------

interface ServiceInfo {
	name: string;
	running: boolean;
	pid: number | null;
	source: string;
	ports: number[];
	proxyPorts: Array<{ internalPort: number; proxyPort: number }>;
	restartPolicy: string;
	circuitBroken: boolean;
	retries?: number;
	crashCount?: number;
	health?: 'healthy' | 'unhealthy' | 'unknown';
	lastError?: string | null;
}

function ServicesTab() {
	const { connected, request, subscribe, orgId } = useNats();
	const [services, setServices] = useState<ServiceInfo[]>([]);
	const [selectedService, setSelectedService] = useState<string | null>(null);
	const [logLines, setLogLines] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);

	// One-shot fetch + subscribe to change events (no polling)
	useEffect(() => {
		if (!connected) return;
		const fetchServices = async () => {
			try {
				const reply = await request(`khal.${orgId}.services.list`, {});
				setServices((reply as { services?: ServiceInfo[] }).services ?? []);
			} catch {
				// silent
			} finally {
				setLoading(false);
			}
		};
		fetchServices();
		const unsub = subscribe('khal._internal.services.changed', (data) => {
			const payload = data as { services?: ServiceInfo[] };
			if (payload.services) {
				setServices(payload.services);
				setLoading(false);
			}
		});
		return unsub;
	}, [connected, request, subscribe, orgId]);

	// Subscribe to live logs for selected service
	useEffect(() => {
		if (!selectedService || !connected) return;
		setLogLines([]);
		request(`khal.${orgId}.services.logs.${selectedService}.history`, { lines: 200 })
			.then((reply) => setLogLines((reply as { lines?: string[] }).lines ?? []))
			.catch(() => {});
		const unsub = subscribe(`khal.*.services.logs.${selectedService}`, (data) => {
			const d = data as { stream?: string; line?: string };
			setLogLines((prev) => [...prev.slice(-999), `[${d.stream}] ${d.line}`]);
		});
		return unsub;
	}, [selectedService, connected, request, subscribe, orgId]);

	const handleRestart = async (name: string) => {
		await request(`khal.${orgId}.services.restart.${name}`, {});
	};
	const handleStop = async (name: string) => {
		await request(`khal.${orgId}.services.stop.${name}`, {});
	};
	const handleStart = async (name: string) => {
		await request(`khal.${orgId}.services.start.${name}`, {});
	};

	if (loading) return <div className="p-4 text-gray-800">Loading services...</div>;

	return (
		<div className="flex max-w-3xl flex-col gap-6 text-gray-1000">
			<section>
				<SectionHeader title="Services" description="Manage backend services registered via app manifests." />
				<div className="rounded-lg border border-gray-alpha-200 bg-background-100">
					{services.length === 0 && (
						<div className="p-4 text-center text-copy-13 text-gray-700">No services registered.</div>
					)}
					{services.map((svc, i) => (
						<div
							key={svc.name}
							className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray-alpha-100' : ''}`}
						>
							<div className="flex items-center gap-3">
								<span
									className={`h-2.5 w-2.5 rounded-full ${
										svc.circuitBroken ? 'bg-orange-500' : svc.running ? 'bg-green-500' : 'bg-red-500'
									}`}
								/>
								<div>
									<button
										className="text-copy-13 font-medium text-gray-1000 hover:underline"
										onClick={() => setSelectedService(svc.name === selectedService ? null : svc.name)}
									>
										{svc.name}
									</button>
									<div className="flex flex-wrap gap-2 text-copy-12 text-gray-700">
										{svc.pid && <span>PID {svc.pid}</span>}
										<span className={svc.source === 'installed-app' ? 'rounded bg-blue-100 px-1 text-blue-800' : ''}>
											{svc.source}
										</span>
										{svc.restartPolicy && <span>{svc.restartPolicy}</span>}
										{svc.ports?.length > 0 && <span>ports: {svc.ports.join(', ')}</span>}
										{svc.circuitBroken && (
											<span className="rounded bg-orange-100 px-1 text-orange-800">circuit broken</span>
										)}
										{typeof svc.retries === 'number' && svc.retries > 0 && <span>retries: {svc.retries}</span>}
										{typeof svc.crashCount === 'number' && svc.crashCount > 0 && (
											<span className="text-red-700">crashes: {svc.crashCount}</span>
										)}
									</div>
									{svc.lastError && (
										<p className="mt-0.5 truncate text-copy-12 text-red-700" title={svc.lastError}>
											{svc.lastError}
										</p>
									)}
								</div>
							</div>
							<div className="flex gap-2">
								{svc.running ? (
									<>
										<Button size="small" variant="secondary" onClick={() => handleRestart(svc.name)}>
											Restart
										</Button>
										<Button size="small" variant="secondary" onClick={() => handleStop(svc.name)}>
											Stop
										</Button>
									</>
								) : (
									<Button size="small" variant="secondary" onClick={() => handleStart(svc.name)}>
										Start
									</Button>
								)}
							</div>
						</div>
					))}
				</div>
			</section>

			{selectedService && (
				<section>
					<SectionHeader title={`Logs: ${selectedService}`} description="Live service output." />
					<div className="h-64 overflow-auto rounded-lg border border-gray-alpha-200 bg-gray-alpha-50 p-3 font-mono text-copy-12 text-gray-900">
						{logLines.length === 0 ? (
							<div className="text-gray-600">No log output yet.</div>
						) : (
							logLines.map((line, i) => (
								<div key={i} className="whitespace-pre-wrap break-all">
									{line}
								</div>
							))
						)}
					</div>
				</section>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Apps Tab
// ---------------------------------------------------------------------------

interface AppInfo {
	name: string;
	id: string;
	hasTauri: boolean;
	hasManifest: boolean;
	hasDeploy: boolean;
	hasServices: boolean;
	serviceCount: number;
	viewCount: number;
	version?: string;
	description?: string;
}

interface AppEnvField {
	key: string;
	description: string;
	required: boolean;
	default?: string;
	type?: string;
}

function AppsTab() {
	const { connected, request, orgId } = useNats();
	const [apps, setApps] = useState<AppInfo[]>([]);
	const [exporting, setExporting] = useState<string | null>(null);
	const [exportResult, setExportResult] = useState<{ app: string; success: boolean; message: string } | null>(null);
	const [installUrl, setInstallUrl] = useState('');
	const [installing, setInstalling] = useState(false);
	const [installResult, setInstallResult] = useState<{ success: boolean; message: string } | null>(null);
	const [configApp, setConfigApp] = useState<string | null>(null);
	const [envFields, setEnvFields] = useState<AppEnvField[]>([]);
	const [envValues, setEnvValues] = useState<Record<string, string>>({});
	const [savingConfig, setSavingConfig] = useState(false);

	useEffect(() => {
		if (!connected) return;
		const fetchApps = async () => {
			try {
				// Try marketplace installed list first
				const marketplaceReply = await request('os.marketplace.installed', {}).catch(() => null);
				if (marketplaceReply && (marketplaceReply as { apps?: unknown[] }).apps) {
					const installed = (marketplaceReply as { apps: Array<Record<string, unknown>> }).apps;
					setApps(
						installed.map((a) => ({
							name: (a.name as string) ?? (a.id as string) ?? 'Unknown',
							id: a.id as string,
							hasTauri: !!(a.tauri as Record<string, unknown> | undefined)?.exportable,
							hasManifest: a.hasManifest as boolean,
							hasDeploy: a.hasDeploy as boolean,
							hasServices: a.hasServices as boolean,
							serviceCount: a.hasServices ? 1 : 0,
							viewCount: 1,
							version: a.version as string | undefined,
							description: a.description as string | undefined,
						}))
					);
					return;
				}
				// Fallback to services list
				const reply = await request(`khal.${orgId}.services.list`, {});
				const services = (reply as { services?: Array<{ name: string; source: string }> }).services ?? [];
				const appMap = new Map<string, AppInfo>();
				for (const svc of services) {
					const appId = svc.name;
					if (!appMap.has(appId)) {
						appMap.set(appId, {
							name: appId.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
							id: appId,
							hasTauri: false,
							hasManifest: true,
							hasDeploy: false,
							hasServices: true,
							serviceCount: 0,
							viewCount: 1,
						});
					}
					const app = appMap.get(appId)!;
					app.serviceCount++;
				}
				setApps(Array.from(appMap.values()));
			} catch {
				// silent
			}
		};
		fetchApps();
	}, [connected, request, orgId]);

	const handleInstall = async () => {
		if (!installUrl.trim() || !connected) return;
		setInstalling(true);
		setInstallResult(null);
		try {
			const reply = await request('os.marketplace.install', { repoUrl: installUrl.trim() });
			const result = reply as { success: boolean; error?: string; appId?: string };
			setInstallResult({
				success: result.success,
				message: result.success ? `Installed ${result.appId}` : (result.error ?? 'Install failed'),
			});
			if (result.success) setInstallUrl('');
		} catch (err) {
			setInstallResult({ success: false, message: err instanceof Error ? err.message : String(err) });
		} finally {
			setInstalling(false);
		}
	};

	const handleUpdate = async (appId: string) => {
		try {
			await request('os.marketplace.update', { appId });
		} catch {
			// silent
		}
	};

	const handleUninstall = async (appId: string) => {
		try {
			await request('os.marketplace.uninstall', { appId });
			setApps((prev) => prev.filter((a) => a.id !== appId));
		} catch {
			// silent
		}
	};

	const handleExport = async (appId: string) => {
		if (!connected) return;
		setExporting(appId);
		setExportResult(null);
		try {
			const reply = await request('os.app.export', { appId }, 120_000);
			const result = reply as { success: boolean; error?: string; outputPath?: string };
			setExportResult({
				app: appId,
				success: result.success,
				message: result.success
					? `Export complete: ${result.outputPath ?? 'binary ready'}`
					: (result.error ?? 'Export failed — check that src-tauri/ exists in the app package.'),
			});
		} catch (err) {
			setExportResult({
				app: appId,
				success: false,
				message:
					err instanceof Error
						? err.message
						: 'Export request failed. Ensure the app has tauri.exportable: true in khal-app.json.',
			});
		} finally {
			setExporting(null);
		}
	};

	const handleOpenConfig = async (appId: string) => {
		if (configApp === appId) {
			setConfigApp(null);
			return;
		}
		setConfigApp(appId);
		setEnvFields([]);
		setEnvValues({});
		// Fetch env var schema from marketplace
		try {
			const reply = await request('os.marketplace.installed', {});
			const apps = (reply as { apps?: Array<Record<string, unknown>> }).apps ?? [];
			const app = apps.find((a) => a.id === appId);
			if (app && Array.isArray((app as Record<string, unknown>).env)) {
				setEnvFields((app as Record<string, unknown>).env as AppEnvField[]);
			}
		} catch {
			// silent
		}
	};

	const handleSaveConfig = async () => {
		if (!configApp) return;
		setSavingConfig(true);
		try {
			await request('os.marketplace.install', {
				repoUrl: '',
				appId: configApp,
				env: envValues,
			});
		} catch {
			// silent
		} finally {
			setSavingConfig(false);
		}
	};

	return (
		<div className="flex max-w-3xl flex-col gap-6 text-gray-1000">
			{/* Install from GitHub */}
			<section>
				<SectionHeader title="Install from GitHub" description="Enter a GitHub repo URL to install a KhalOS app." />
				<div className="flex gap-2">
					<Input
						size="small"
						placeholder="https://github.com/org/khal-app-name"
						value={installUrl}
						onChange={(e) => setInstallUrl(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleInstall();
						}}
						aria-label="GitHub repo URL"
					/>
					<Button size="small" variant="secondary" onClick={handleInstall} disabled={installing || !connected}>
						{installing ? 'Installing...' : 'Install'}
					</Button>
				</div>
				{installResult && (
					<Note type={installResult.success ? 'success' : 'error'} size="small" className="mt-2">
						{installResult.message}
					</Note>
				)}
			</section>

			<Separator />

			{/* Installed apps list */}
			<section>
				<SectionHeader
					title="Installed Apps"
					description="Manage installed apps. Configure, update, or export as standalone desktop binaries."
				/>
				<div className="rounded-lg border border-gray-alpha-200 bg-background-100">
					{apps.length === 0 && <div className="p-4 text-center text-copy-13 text-gray-700">No apps detected.</div>}
					{apps.map((app, i) => (
						<div key={app.id} className={i > 0 ? 'border-t border-gray-alpha-100' : ''}>
							<div className="flex items-center justify-between px-4 py-3">
								<div>
									<p className="text-copy-13 font-medium text-gray-1000">{app.name}</p>
									<div className="flex gap-3 text-copy-12 text-gray-700">
										{app.version && <span>v{app.version}</span>}
										<span>
											{app.serviceCount} service{app.serviceCount !== 1 ? 's' : ''}
										</span>
										{app.hasDeploy && <span className="text-blue-700">k8s</span>}
										{app.hasTauri && <span className="text-green-700">Tauri ready</span>}
									</div>
									{app.description && <p className="mt-0.5 text-copy-12 text-gray-600">{app.description}</p>}
								</div>
								<div className="flex gap-2">
									<Button size="small" variant="secondary" onClick={() => handleOpenConfig(app.id)}>
										{configApp === app.id ? 'Close' : 'Configure'}
									</Button>
									<Button size="small" variant="secondary" onClick={() => handleUpdate(app.id)}>
										Update
									</Button>
									<Button
										size="small"
										variant="secondary"
										onClick={() => handleExport(app.id)}
										disabled={exporting === app.id || !app.hasTauri}
										title={app.hasTauri ? 'Export as standalone desktop app' : 'App does not support Tauri export'}
									>
										{exporting === app.id ? 'Exporting...' : 'Export'}
									</Button>
									<Button size="small" variant="secondary" onClick={() => handleUninstall(app.id)}>
										Uninstall
									</Button>
								</div>
							</div>

							{/* App Config Panel (Group 6) */}
							{configApp === app.id && (
								<div className="border-t border-gray-alpha-100 bg-gray-alpha-50 px-4 py-3">
									<p className="mb-2 text-copy-12 font-medium text-gray-900">Environment Configuration</p>
									{envFields.length === 0 ? (
										<p className="text-copy-12 text-gray-600">No configurable environment variables.</p>
									) : (
										<div className="flex flex-col gap-2">
											{envFields.map((field) => (
												<div key={field.key} className="flex items-center gap-3">
													<label
														className="w-40 shrink-0 text-copy-12 font-medium text-gray-900"
														title={field.description}
													>
														{field.key}
														{field.required && <span className="text-red-600">*</span>}
													</label>
													<Input
														size="small"
														type={field.type === 'secret' ? 'password' : 'text'}
														placeholder={field.default ?? field.description}
														value={envValues[field.key] ?? ''}
														onChange={(e) => setEnvValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
														aria-label={field.key}
													/>
												</div>
											))}
											<div className="mt-2 flex justify-end">
												<Button size="small" variant="secondary" onClick={handleSaveConfig} disabled={savingConfig}>
													{savingConfig ? 'Saving...' : 'Save Configuration'}
												</Button>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					))}
				</div>
			</section>

			{exportResult && (
				<Note type={exportResult.success ? 'success' : 'warning'} size="small">
					<strong>{exportResult.app}:</strong> {exportResult.message}
				</Note>
			)}
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
