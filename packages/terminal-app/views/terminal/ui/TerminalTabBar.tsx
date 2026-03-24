'use client';

import type { TerminalTab } from '../types';

interface TerminalTabBarProps {
	tabs: TerminalTab[];
	activeTabId: string;
	onTabClick: (tabId: string) => void;
	onTabClose: (tabId: string) => void;
	onNewTab: () => void;
}

/**
 * Tab bar component for multi-tab terminal.
 * macOS-style pill tabs with --os-* CSS tokens.
 *
 * The outer container does NOT have data-no-drag so empty
 * space in the tab bar area acts as a window drag handle.
 * Only interactive elements (tabs, buttons) have data-no-drag.
 */
export function TerminalTabBar({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }: TerminalTabBarProps) {
	const getTabTitle = (tab: TerminalTab) => {
		if (tab.cwd) {
			const parts = tab.cwd.split('/');
			return parts[parts.length - 1] || 'root';
		}
		return tab.title || 'bash';
	};

	// Reserve space for the floating window controls (glass controls on the right)
	const prControls = '100px';

	return (
		<div
			className="terminal-tab-bar flex items-center gap-1 px-2 py-1.5"
			style={{
				paddingRight: prControls,
				minHeight: '36px',
			}}
		>
			{tabs.map((tab) => {
				const isActive = tab.id === activeTabId;
				return (
					<div
						data-no-drag
						key={tab.id}
						className="flex items-center gap-1.5 rounded-md px-2.5 py-1 cursor-pointer select-none transition-all duration-150"
						style={
							isActive
								? {
										background: 'var(--os-surface-raised)',
										color: 'var(--os-text-primary)',
									}
								: {
										background: 'transparent',
										color: 'var(--os-text-muted)',
									}
						}
						onMouseEnter={(e) => {
							if (!isActive) {
								const el = e.currentTarget as HTMLElement;
								el.style.color = 'var(--os-text-secondary)';
								el.style.background = 'var(--os-accent-subtle)';
							}
						}}
						onMouseLeave={(e) => {
							if (!isActive) {
								const el = e.currentTarget as HTMLElement;
								el.style.color = 'var(--os-text-muted)';
								el.style.background = 'transparent';
							}
						}}
						onClick={() => onTabClick(tab.id)}
					>
						<span className="text-xs max-w-[120px] truncate">{getTabTitle(tab)}</span>
						{tabs.length > 1 && (
							<button
								data-no-drag
								className="flex h-4 w-4 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
								style={{
									color: 'var(--os-text-muted)',
									opacity: isActive ? 0.6 : 0,
								}}
								onMouseEnter={(e) => {
									const el = e.currentTarget as HTMLElement;
									el.style.opacity = '1';
									el.style.color = 'rgb(239, 68, 68)';
								}}
								onMouseLeave={(e) => {
									const el = e.currentTarget as HTMLElement;
									el.style.opacity = isActive ? '0.6' : '0';
									el.style.color = 'var(--os-text-muted)';
								}}
								onClick={(e) => {
									e.stopPropagation();
									onTabClose(tab.id);
								}}
								aria-label="Close tab"
							>
								<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
									<path d="M1 1l6 6M7 1l-6 6" />
								</svg>
							</button>
						)}
					</div>
				);
			})}
			<button
				data-no-drag
				className="flex h-5 w-5 items-center justify-center rounded-md transition-colors"
				style={{ color: 'var(--os-text-muted)' }}
				onMouseEnter={(e) => {
					const el = e.currentTarget as HTMLElement;
					el.style.color = 'var(--os-text-primary)';
					el.style.background = 'var(--os-accent-subtle)';
				}}
				onMouseLeave={(e) => {
					const el = e.currentTarget as HTMLElement;
					el.style.color = 'var(--os-text-muted)';
					el.style.background = '';
				}}
				onClick={onNewTab}
				aria-label="New tab"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
					<path d="M5 1v8M1 5h8" />
				</svg>
			</button>
		</div>
	);
}
