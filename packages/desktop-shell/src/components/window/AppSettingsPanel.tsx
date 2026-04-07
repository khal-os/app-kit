import { useNats } from '@khal-os/sdk/app';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Manifest info passed from the consumer (via WindowRenderer). */
export interface AppManifestInfo {
	label: string;
	permission?: string;
	minRole?: string;
	natsPrefix?: string;
	storeMeta?: {
		name: string;
		version: string;
		author: string;
		description: string;
		permissions?: string[];
	};
}

interface AppSettingsPanelProps {
	windowId: string;
	appId: string;
	manifest?: AppManifestInfo;
	onClose: () => void;
}

interface ServiceInfo {
	name: string;
	running: boolean;
	pid: number | null;
	source: string;
	ports: number[];
	proxyPorts: Array<{ internalPort: number; proxyPort: number }>;
	restartPolicy: string;
	circuitBroken: boolean;
	uptime?: number;
}

interface AppVersionInfo {
	version?: string;
	installDate?: string;
}

type SettingsTab = 'about' | 'service' | 'integrations';

// ---------------------------------------------------------------------------
// Integration definitions per app
// ---------------------------------------------------------------------------

const APP_INTEGRATIONS: Record<string, Array<{ name: string; icon: string; status: string }>> = {
	files: [
		{ name: 'Google Drive', icon: '/icons/integrations/google-drive.svg', status: 'soon' },
		{ name: 'OneDrive', icon: '/icons/integrations/onedrive.svg', status: 'soon' },
	],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
}

/** Check if an app has declared services based on manifest data. */
function appHasServices(manifest?: AppManifestInfo): boolean {
	return !!manifest?.natsPrefix;
}

/** Check if an app has integrations defined. */
function appHasIntegrations(appId: string): boolean {
	return appId in APP_INTEGRATIONS;
}

// ---------------------------------------------------------------------------
// Log Viewer (text-based, lightweight alternative to xterm.js for settings)
// ---------------------------------------------------------------------------

function LogViewer({ serviceName }: { serviceName: string }) {
	const { connected, request, subscribe, orgId } = useNats();
	const [logLines, setLogLines] = useState<string[]>([]);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!connected || !serviceName) return;
		setLogLines([]);

		// Load history
		request(`khal.${orgId}.services.logs.${serviceName}.history`, { lines: 200 })
			.then((reply) => setLogLines((reply as { lines?: string[] }).lines ?? []))
			.catch(() => {});

		// Subscribe to live stream
		const unsub = subscribe(`khal.*.services.logs.${serviceName}`, (data) => {
			const d = data as { stream?: string; line?: string };
			setLogLines((prev) => [...prev.slice(-999), `[${d.stream}] ${d.line}`]);
		});
		return unsub;
	}, [connected, serviceName, request, subscribe, orgId]);

	// Auto-scroll to bottom on new lines
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [logLines]);

	return (
		<div
			ref={scrollRef}
			className="overflow-auto rounded border font-mono"
			style={{
				height: 140,
				fontSize: '11px',
				lineHeight: '16px',
				padding: '6px 8px',
				background: 'var(--khal-surface-default, #0a0a0a)',
				borderColor: 'var(--khal-border-default)',
				color: 'var(--khal-text-muted)',
			}}
		>
			{logLines.length === 0 ? (
				<div style={{ color: 'var(--khal-text-muted)' }}>No log output yet.</div>
			) : (
				logLines.map((line, i) => (
					<div key={i} className="whitespace-pre-wrap break-all">
						{line}
					</div>
				))
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// About Tab
// ---------------------------------------------------------------------------

function AboutTab({ appId, manifest }: { appId: string; manifest?: AppManifestInfo }) {
	const { connected, request, orgId } = useNats();
	const [versionInfo, setVersionInfo] = useState<AppVersionInfo>({});

	useEffect(() => {
		if (!connected) return;
		request('os.genie.apps.get', { appId })
			.then((reply) => {
				const data = reply as { version?: string; installed_at?: string };
				setVersionInfo({ version: data.version, installDate: data.installed_at });
			})
			.catch(() => {});
	}, [connected, request, orgId, appId]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-2">
				<Row label="Name">{manifest?.label ?? appId}</Row>
				<Row label="Slug">{appId}</Row>
				<Row label="Version">{versionInfo.version ?? 'dev'}</Row>
				<Row label="Permission">{manifest?.permission ?? '—'}</Row>
				{versionInfo.installDate && (
					<Row label="Installed">{new Date(versionInfo.installDate).toLocaleDateString()}</Row>
				)}
			</div>
		</div>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between" style={{ fontSize: '12px' }}>
			<span style={{ color: 'var(--khal-text-muted)' }}>{label}</span>
			<span style={{ color: 'var(--khal-text-primary)', fontWeight: 500 }}>{children}</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Service Tab
// ---------------------------------------------------------------------------

function ServiceTab({ appId, manifest }: { appId: string; manifest?: AppManifestInfo }) {
	const { connected, request, subscribe, orgId } = useNats();
	const [services, setServices] = useState<ServiceInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!connected) return;
		const fetchServices = async () => {
			try {
				const reply = await request(`khal.${orgId}.services.list`, {});
				const all = (reply as { services?: ServiceInfo[] }).services ?? [];
				const prefix = manifest?.natsPrefix;
				const filtered = prefix
					? all.filter((s) => s.name.includes(prefix) || s.source?.includes(appId))
					: all.filter((s) => s.source?.includes(appId));
				setServices(filtered.length > 0 ? filtered : all);
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
				const prefix = manifest?.natsPrefix;
				const filtered = prefix
					? payload.services.filter((s) => s.name.includes(prefix) || s.source?.includes(appId))
					: payload.services.filter((s) => s.source?.includes(appId));
				setServices(filtered.length > 0 ? filtered : payload.services);
				setLoading(false);
			}
		});
		return unsub;
	}, [connected, request, subscribe, orgId, appId, manifest?.natsPrefix]);

	const handleRestart = useCallback(
		async (name: string) => {
			await request(`khal.${orgId}.services.restart.${name}`, {});
		},
		[request, orgId]
	);

	const handleStop = useCallback(
		async (name: string) => {
			await request(`khal.${orgId}.services.stop.${name}`, {});
		},
		[request, orgId]
	);

	if (loading) {
		return (
			<div style={{ fontSize: '12px', color: 'var(--khal-text-muted)', padding: '8px 0' }}>Loading services...</div>
		);
	}

	if (services.length === 0) {
		return (
			<div style={{ fontSize: '12px', color: 'var(--khal-text-muted)', padding: '8px 0' }}>No services found.</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{services.map((svc) => (
				<div
					key={svc.name}
					className="flex flex-col gap-2 rounded border p-2"
					style={{ borderColor: 'var(--khal-border-default)' }}
				>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span
								className="rounded-full"
								style={{
									width: 8,
									height: 8,
									background: svc.running ? '#22c55e' : '#ef4444',
								}}
							/>
							<span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--khal-text-primary)' }}>{svc.name}</span>
						</div>
						<div className="flex gap-1.5">
							{svc.running && (
								<>
									<ActionButton onClick={() => handleRestart(svc.name)}>Restart</ActionButton>
									<ActionButton onClick={() => handleStop(svc.name)}>Stop</ActionButton>
								</>
							)}
						</div>
					</div>
					<div className="flex gap-3" style={{ fontSize: '11px', color: 'var(--khal-text-muted)' }}>
						{svc.pid && <span>PID {svc.pid}</span>}
						{svc.uptime != null && <span>{formatUptime(svc.uptime)}</span>}
						{svc.ports?.length > 0 && <span>ports: {svc.ports.join(', ')}</span>}
						{svc.restartPolicy && <span>{svc.restartPolicy}</span>}
					</div>
					{svc.running && <LogViewer serviceName={svc.name} />}
				</div>
			))}
		</div>
	);
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
			style={{
				background: 'var(--khal-controls-bg)',
				color: 'var(--khal-text-muted)',
				border: '1px solid var(--khal-border-default)',
			}}
			onMouseEnter={(e) => {
				(e.currentTarget as HTMLElement).style.background = 'var(--khal-controls-minimize-hover-bg)';
			}}
			onMouseLeave={(e) => {
				(e.currentTarget as HTMLElement).style.background = 'var(--khal-controls-bg)';
			}}
			onClick={onClick}
		>
			{children}
		</button>
	);
}

// ---------------------------------------------------------------------------
// Integrations Tab
// ---------------------------------------------------------------------------

function IntegrationsTab({ appId }: { appId: string }) {
	const integrations = APP_INTEGRATIONS[appId] ?? [];

	if (integrations.length === 0) {
		return (
			<div style={{ fontSize: '12px', color: 'var(--khal-text-muted)', padding: '8px 0' }}>
				No integrations available.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{integrations.map((integration) => (
				<div
					key={integration.name}
					className="flex items-center gap-3 rounded border p-3"
					style={{ borderColor: 'var(--khal-border-default)' }}
				>
					<img src={integration.icon} alt={integration.name} className="h-8 w-8" />
					<div className="flex-1">
						<span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--khal-text-primary)' }}>
							{integration.name}
						</span>
					</div>
					<span
						className="rounded-full px-2 py-0.5"
						style={{
							fontSize: '10px',
							fontWeight: 600,
							background: 'var(--khal-surface-default)',
							color: 'var(--khal-text-muted)',
							border: '1px solid var(--khal-border-default)',
						}}
					>
						(soon)
					</span>
				</div>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function AppSettingsPanel({ windowId: _windowId, appId, manifest, onClose }: AppSettingsPanelProps) {
	const [visible, setVisible] = useState(false);
	const hasServices = appHasServices(manifest);
	const hasIntegrations = appHasIntegrations(appId);

	const availableTabs: SettingsTab[] = ['about'];
	if (hasServices) availableTabs.push('service');
	if (hasIntegrations) availableTabs.push('integrations');

	const [activeTab, setActiveTab] = useState<SettingsTab>('about');

	// Slide-in animation
	useEffect(() => {
		requestAnimationFrame(() => setVisible(true));
	}, []);

	return (
		<div
			className="flex flex-col overflow-hidden"
			style={{
				height: visible ? (activeTab === 'service' ? 320 : 240) : 0,
				borderTop: '1px solid var(--khal-border-default)',
				background: 'var(--khal-surface-default)',
				transition: 'height 200ms ease-out',
			}}
			onPointerDown={(e) => e.stopPropagation()}
			data-no-drag
		>
			{/* Header */}
			<div
				className="flex shrink-0 items-center justify-between px-3"
				style={{ height: 32, borderBottom: '1px solid var(--khal-border-default)' }}
			>
				<div className="flex items-center gap-1">
					{availableTabs.map((tab) => (
						<button
							key={tab}
							type="button"
							className="rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors"
							style={{
								background: activeTab === tab ? 'var(--khal-accent-blue)' : 'transparent',
								color: activeTab === tab ? '#fff' : 'var(--khal-text-muted)',
							}}
							onClick={() => setActiveTab(tab)}
						>
							{tab}
						</button>
					))}
				</div>
				<button
					type="button"
					className="flex h-5 w-5 items-center justify-center rounded transition-colors"
					style={{ color: 'var(--khal-text-muted)' }}
					onClick={onClose}
					aria-label="Close settings panel"
				>
					<X size={12} />
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto px-3 py-2">
				{activeTab === 'about' && <AboutTab appId={appId} manifest={manifest} />}
				{activeTab === 'service' && <ServiceTab appId={appId} manifest={manifest} />}
				{activeTab === 'integrations' && <IntegrationsTab appId={appId} />}
			</div>
		</div>
	);
}
