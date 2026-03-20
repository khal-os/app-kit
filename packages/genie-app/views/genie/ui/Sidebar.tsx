'use client';

import { useCallback, useState } from 'react';
import { AgentsPanel } from './panels/AgentsPanel';
import { ChatPanel } from './panels/ChatPanel';
import { SystemPanel } from './panels/SystemPanel';
import { TeamsPanel } from './panels/TeamsPanel';
import { WishesPanel } from './panels/WishesPanel';

// --- Panel definitions ---

export type PanelId = 'teams' | 'agents' | 'wishes' | 'chat' | 'system';

interface PanelDef {
	id: PanelId;
	label: string;
	icon: React.ReactNode;
	component: React.ComponentType;
}

// SVG icons (16x16) matching the existing design language
function UsersIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Teams</title>
			<circle cx="6" cy="5" r="2.5" />
			<path d="M2 13.5c0-2.5 1.8-4 4-4s4 1.5 4 4" />
			<circle cx="11" cy="4.5" r="1.8" />
			<path d="M11.5 9.5c1.5.3 2.5 1.5 2.5 3" />
		</svg>
	);
}

function BotIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Agents</title>
			<rect x="2" y="4" width="12" height="9" rx="2" />
			<circle cx="5.5" cy="8.5" r="1" />
			<circle cx="10.5" cy="8.5" r="1" />
			<path d="M8 1v3" />
			<circle cx="8" cy="1" r="0.8" fill="currentColor" />
		</svg>
	);
}

function WandIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Wishes</title>
			<path d="M9 2l1 2.5L12.5 5l-2 1.8.5 2.7L9 8.3 6.5 9.5l.5-2.7-2-1.8L7.5 4.5z" />
			<path d="M5 11l-3 3" />
		</svg>
	);
}

function ChatIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Chat</title>
			<path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 2.5V4a1 1 0 011-1z" />
		</svg>
	);
}

function HeartPulseIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>System</title>
			<path d="M1 8h3l1.5-3 2 6 1.5-3H12" />
			<path d="M13.5 6.5a2.5 2.5 0 00-4.2-1.8L8 6l-1.3-1.3a2.5 2.5 0 00-4.2 1.8" />
		</svg>
	);
}

const PANELS: PanelDef[] = [
	{ id: 'teams', label: 'Teams', icon: <UsersIcon />, component: TeamsPanel },
	{ id: 'agents', label: 'Agents', icon: <BotIcon />, component: AgentsPanel },
	{ id: 'wishes', label: 'Wishes', icon: <WandIcon />, component: WishesPanel },
	{ id: 'chat', label: 'Chat', icon: <ChatIcon />, component: ChatPanel },
	{ id: 'system', label: 'System', icon: <HeartPulseIcon />, component: SystemPanel },
];

const COLLAPSED_WIDTH = 48;
const EXPANDED_WIDTH = 280;

// --- Sidebar component ---

export function Sidebar() {
	const [activePanel, setActivePanel] = useState<PanelId | null>(null);
	// Track which panels have been opened at least once (lazy mount)
	const [mounted, setMounted] = useState<Set<PanelId>>(new Set());

	const expanded = activePanel !== null;

	const handleIconClick = useCallback((panelId: PanelId) => {
		setActivePanel((prev) => (prev === panelId ? null : panelId));
		setMounted((prev) => {
			if (prev.has(panelId)) return prev;
			const next = new Set(prev);
			next.add(panelId);
			return next;
		});
	}, []);

	return (
		<div
			className="flex h-full shrink-0 border-r border-white/10 bg-black/30 overflow-hidden"
			style={{
				width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
				transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
			}}
		>
			{/* Icon rail */}
			<div className="flex w-12 shrink-0 flex-col items-center gap-1 py-2">
				{PANELS.map((panel) => {
					const isActive = activePanel === panel.id;
					return (
						<button
							key={panel.id}
							type="button"
							onClick={() => handleIconClick(panel.id)}
							className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
								isActive
									? 'bg-white/15 text-[var(--os-text-primary)]'
									: 'text-[var(--os-text-secondary)] hover:bg-white/10 hover:text-[var(--os-text-primary)]'
							}`}
							title={panel.label}
						>
							{panel.icon}
						</button>
					);
				})}
			</div>

			{/* Panel content area — always rendered when expanded to preserve state */}
			{expanded && (
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-white/5">
					{/* Panel header */}
					<div className="flex shrink-0 items-center px-3 py-2 border-b border-white/10">
						<span className="text-xs font-semibold text-[var(--os-text-primary)]">
							{PANELS.find((p) => p.id === activePanel)?.label}
						</span>
					</div>

					{/* Panel bodies — render all mounted panels, show only active */}
					<div className="min-h-0 flex-1 relative">
						{PANELS.map((panel) => {
							if (!mounted.has(panel.id)) return null;
							const isActive = activePanel === panel.id;
							const PanelComponent = panel.component;
							return (
								<div
									key={panel.id}
									className="absolute inset-0 overflow-y-auto"
									style={{ display: isActive ? 'block' : 'none' }}
								>
									<PanelComponent />
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
