'use client';

interface SessionTab {
	id: string;
	name: string;
	paneCount: number;
	color: string;
}

interface TabBarProps {
	tabs: SessionTab[];
	activeSessionId: string | null;
	onSelectSession: (sessionId: string) => void;
	onResetLayout?: () => void;
}

export function TabBar({ tabs, activeSessionId, onSelectSession, onResetLayout }: TabBarProps) {
	if (tabs.length === 0) return null;

	return (
		<div className="flex items-center gap-0.5 overflow-x-auto border-b border-white/10 bg-black/30 px-1">
			{tabs.map((tab) => {
				const isActive = tab.id === activeSessionId;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => onSelectSession(tab.id)}
						className={`group flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-xs transition-colors ${
							isActive
								? 'border-current text-[var(--os-text-primary)]'
								: 'border-transparent text-[var(--os-text-secondary)] hover:text-[var(--os-text-primary)]'
						}`}
						style={{
							borderLeftWidth: 3,
							borderLeftStyle: 'solid',
							borderLeftColor: tab.color,
						}}
					>
						<span className="font-medium">{tab.name}</span>
						<span
							className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
								isActive ? 'bg-white/10 text-[var(--os-text-primary)]' : 'bg-white/5 text-[var(--os-text-secondary)]'
							}`}
						>
							{tab.paneCount}
						</span>
					</button>
				);
			})}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Reset layout button */}
			{onResetLayout && (
				<button
					type="button"
					onClick={onResetLayout}
					className="shrink-0 rounded px-2 py-1 text-[10px] text-[var(--os-text-secondary)] hover:bg-white/10 hover:text-[var(--os-text-primary)]"
					title="Reset layout to auto-grid"
				>
					Reset Layout
				</button>
			)}
		</div>
	);
}

export type { SessionTab };
