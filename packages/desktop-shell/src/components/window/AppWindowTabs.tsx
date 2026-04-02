import { Info, Layout } from 'lucide-react';
import { useState } from 'react';
import { AppErrorBoundary } from './AppErrorBoundary';

type TabId = 'ui' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
	{ id: 'ui', label: 'UI', icon: <Layout size={13} /> },
	{ id: 'settings', label: 'Settings', icon: <Info size={13} /> },
];

/** Manifest-like shape for the settings tab. */
interface AppManifestInfo {
	label: string;
	showTabs?: boolean;
	fullSizeContent?: boolean;
	storeMeta?: {
		name: string;
		version: string;
		author: string;
		description: string;
		permissions?: string[];
	};
	minRole?: string;
	natsPrefix?: string;
	permission?: string;
}

interface AppWindowTabsProps {
	appId: string;
	manifest: AppManifestInfo;
	children: React.ReactNode;
}

function SettingsTab({ appId, manifest }: { appId: string; manifest: AppManifestInfo }) {
	const meta = manifest.storeMeta;
	return (
		<div className="flex flex-col gap-4 p-4 overflow-auto h-full" style={{ color: 'var(--khal-text-primary)' }}>
			<h3 className="text-sm font-semibold" style={{ color: 'var(--khal-text-primary)' }}>
				App Information
			</h3>
			<div
				className="rounded-lg p-4 flex flex-col gap-3"
				style={{
					background: 'var(--khal-surface-raised, rgba(255,255,255,0.05))',
					border: '1px solid var(--khal-border-default)',
				}}
			>
				<SettingsRow label="Name" value={meta?.name || manifest.label} />
				<SettingsRow label="ID" value={appId} />
				{meta?.version && <SettingsRow label="Version" value={meta.version} />}
				{meta?.author && <SettingsRow label="Author" value={meta.author} />}
				{meta?.description && <SettingsRow label="Description" value={meta.description} />}
				<SettingsRow label="Min Role" value={manifest.minRole ?? 'member'} />
				{manifest.natsPrefix && <SettingsRow label="NATS Prefix" value={manifest.natsPrefix} />}
				{meta?.permissions && meta.permissions.length > 0 && (
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium" style={{ color: 'var(--khal-text-muted)' }}>
							Permissions
						</span>
						<div className="flex flex-wrap gap-1">
							{meta.permissions.map((p) => (
								<span
									key={p}
									className="rounded px-1.5 py-0.5 text-[11px]"
									style={{
										background: 'var(--khal-surface-default, rgba(255,255,255,0.08))',
										color: 'var(--khal-text-secondary)',
									}}
								>
									{p}
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function SettingsRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<span className="text-xs font-medium shrink-0" style={{ color: 'var(--khal-text-muted)' }}>
				{label}
			</span>
			<span className="text-xs text-right" style={{ color: 'var(--khal-text-secondary, var(--khal-text-primary))' }}>
				{value}
			</span>
		</div>
	);
}

/**
 * 2-tab window pattern for apps with showTabs: true.
 * Tab bar: UI | Settings.
 */
export function AppWindowTabs({ appId, manifest, children }: AppWindowTabsProps) {
	const [activeTab, setActiveTab] = useState<TabId>('ui');

	return (
		<div className="flex h-full flex-col">
			{/* Tab bar */}
			<div
				className="flex shrink-0 items-center gap-0 px-2"
				style={{
					height: 32,
					borderBottom: '1px solid var(--khal-border-default)',
					background: 'var(--khal-surface-default, rgba(255,255,255,0.02))',
				}}
				data-no-drag
			>
				{TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors rounded-t-md"
						style={{
							color: activeTab === tab.id ? 'var(--khal-text-primary)' : 'var(--khal-text-muted)',
							borderBottom:
								activeTab === tab.id ? '2px solid var(--khal-accent-blue, #0070f3)' : '2px solid transparent',
						}}
						onClick={() => setActiveTab(tab.id)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{/* Tab content */}
			<div className="flex-1 overflow-hidden">
				{activeTab === 'ui' && <AppErrorBoundary appName={manifest.label}>{children}</AppErrorBoundary>}
				{activeTab === 'settings' && <SettingsTab appId={appId} manifest={manifest} />}
			</div>
		</div>
	);
}
