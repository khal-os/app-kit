'use client';

import type { SandboxState } from '@khal-os/sdk/app';
import { Badge, Button, Spinner } from '@khal-os/ui';
import { Check, Container, Download, Lock, Trash2 } from 'lucide-react';

/** Shape of a store catalog entry returned by `os.apps.store.list`. */
export interface StoreEntry {
	slug: string;
	name: string;
	shortDescription: string | null;
	iconUrl: string | null;
	iconLucide: string | null;
	category: string | null;
	minRole: string | null;
	/** Whether this app requires a per-user sandbox (derived from manifestJson). */
	sandboxRequired?: boolean;
}

export interface AppCardProps {
	app: StoreEntry;
	installed: boolean;
	authorized: boolean;
	installing: boolean;
	uninstalling: boolean;
	/** Sandbox provisioning state (only for sandbox-enabled apps after install). */
	sandboxState?: SandboxState;
	onInstall: (slug: string) => void;
	onUninstall: (slug: string) => void;
}

const CATEGORY_VARIANT: Record<string, 'blue' | 'green' | 'amber' | 'purple' | 'teal' | 'gray'> = {
	System: 'blue',
	Development: 'green',
	Productivity: 'amber',
	Communication: 'purple',
	AI: 'teal',
};

export function AppCard({ app, installed, authorized, installing, uninstalling, sandboxState, onInstall, onUninstall }: AppCardProps) {
	const busy = installing || uninstalling;
	const iconSrc = app.iconUrl ?? '/icons/dusk/default.svg';
	const isProvisioning = sandboxState === 'provisioning';

	return (
		<div
			className="group flex flex-col rounded-xl border p-4 transition-all hover:shadow-md"
			style={{
				borderColor: 'var(--khal-border-default, oklch(0.8 0 0 / 0.3))',
				background: 'var(--khal-bg-card, oklch(0.98 0 0 / 0.6))',
			}}
		>
			{/* Header: icon + name + category */}
			<div className="flex items-start gap-3">
				<img
					src={iconSrc}
					alt={app.name}
					className="h-12 w-12 shrink-0 rounded-lg object-contain"
					draggable={false}
				/>
				<div className="min-w-0 flex-1">
					<h3 className="truncate text-sm font-semibold" style={{ color: 'var(--khal-text-primary)' }}>
						{app.name}
					</h3>
					{app.category && (
						<Badge variant={CATEGORY_VARIANT[app.category] ?? 'gray'} size="sm" className="mt-1">
							{app.category}
						</Badge>
					)}
				</div>
			</div>

			{/* Description */}
			{app.shortDescription && (
				<p
					className="mt-2 line-clamp-2 text-xs leading-relaxed"
					style={{ color: 'var(--khal-text-secondary)' }}
				>
					{app.shortDescription}
				</p>
			)}

			{/* Action button */}
			<div className="mt-auto pt-3">
				{isProvisioning ? (
					<div className="flex items-center gap-2">
						<Spinner size="sm" />
						<span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--khal-text-secondary)' }}>
							<Container className="h-3.5 w-3.5" />
							Setting up workspace…
						</span>
					</div>
				) : sandboxState === 'error' ? (
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium" style={{ color: 'var(--khal-text-danger, #ef4444)' }}>
							Sandbox failed
						</span>
						<Button
							variant="ghost"
							size="small"
							className="ml-auto"
							disabled={busy}
							onClick={() => onUninstall(app.slug)}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</div>
				) : installed ? (
					<div className="flex items-center gap-2">
						<span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--khal-text-secondary)' }}>
							<Check className="h-3.5 w-3.5" />
							Installed
						</span>
						<Button
							variant="ghost"
							size="small"
							className="ml-auto"
							disabled={busy}
							onClick={() => onUninstall(app.slug)}
						>
							{uninstalling ? <Spinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
						</Button>
					</div>
				) : !authorized ? (
					<Button variant="secondary" size="small" className="w-full" disabled>
						<Lock className="mr-1 h-3.5 w-3.5" />
						Request Access
					</Button>
				) : (
					<Button
						variant="default"
						size="small"
						className="w-full"
						disabled={busy}
						onClick={() => onInstall(app.slug)}
					>
						{installing ? (
							<Spinner size="sm" />
						) : (
							<>
								<Download className="mr-1 h-3.5 w-3.5" />
								Install
							</>
						)}
					</Button>
				)}
			</div>
		</div>
	);
}
