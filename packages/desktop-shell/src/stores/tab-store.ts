import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useWindowStore } from './window-store';

export interface DesktopTab {
	id: string;
	label: string;
	order: number;
}

interface TabStore {
	tabs: DesktopTab[];
	activeTabId: string;
	addTab: () => void;
	removeTab: (id: string) => void;
	renameTab: (id: string, label: string) => void;
	reorderTabs: (orderedIds: string[]) => void;
	setActiveTab: (id: string) => void;
}

const DEFAULT_TAB: DesktopTab = { id: 'desktop-1', label: 'Desktop 1', order: 0 };

function nextDesktopNumber(tabs: DesktopTab[]): number {
	let max = 0;
	for (const tab of tabs) {
		const match = tab.id.match(/^desktop-(\d+)$/);
		if (match) {
			const n = Number.parseInt(match[1], 10);
			if (n > max) max = n;
		}
	}
	return max + 1;
}

export const useTabStore = create<TabStore>()(
	persist(
		(set, get) => ({
			tabs: [DEFAULT_TAB],
			activeTabId: DEFAULT_TAB.id,

			addTab: () => {
				const { tabs } = get();
				const n = nextDesktopNumber(tabs);
				const newTab: DesktopTab = {
					id: `desktop-${n}`,
					label: `Desktop ${n}`,
					order: tabs.length,
				};
				set({
					tabs: [...tabs, newTab],
					activeTabId: newTab.id,
				});
				useWindowStore.getState().setActiveWorkspace(newTab.id);
			},

			removeTab: (id) => {
				const { tabs, activeTabId } = get();
				if (tabs.length <= 1) return;

				const idx = tabs.findIndex((t) => t.id === id);
				const remaining = tabs.filter((t) => t.id !== id).map((t, i) => ({ ...t, order: i }));

				let newActiveId = activeTabId;
				if (activeTabId === id) {
					// Switch to previous tab, or first if removing the first
					const prevIdx = Math.max(0, idx - 1);
					newActiveId = remaining[prevIdx].id;
				}

				set({ tabs: remaining, activeTabId: newActiveId });

				// Clean up windows belonging to the removed workspace and switch
				const wState = useWindowStore.getState();
				const { [id]: _removed, ...rest } = wState.windowsByWorkspace;
				useWindowStore.setState({ windowsByWorkspace: rest, activeWorkspaceId: newActiveId });
			},

			renameTab: (id, label) => {
				set((state) => ({
					tabs: state.tabs.map((t) => (t.id === id ? { ...t, label } : t)),
				}));
			},

			reorderTabs: (orderedIds) => {
				set((state) => {
					const tabMap = new Map(state.tabs.map((t) => [t.id, t]));
					const reordered: DesktopTab[] = [];
					for (let i = 0; i < orderedIds.length; i++) {
						const tab = tabMap.get(orderedIds[i]);
						if (tab) {
							reordered.push({ ...tab, order: i });
						}
					}
					return { tabs: reordered };
				});
			},

			setActiveTab: (id) => {
				set({ activeTabId: id });
				useWindowStore.getState().setActiveWorkspace(id);
			},
		}),
		{
			name: 'khal-desktop-tabs',
			onRehydrateStorage: () => {
				// After persisted state is restored, sync window store's activeWorkspaceId
				return (state) => {
					if (state?.activeTabId) {
						useWindowStore.getState().setActiveWorkspace(state.activeTabId);
					}
				};
			},
		}
	)
);
