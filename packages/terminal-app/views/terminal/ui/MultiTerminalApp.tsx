'use client';

import { getNatsClient, SUBJECTS } from '@khal-os/sdk/app';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useWindowStore } from '@/stores/window-store';
import type { SplitNode, TerminalTab } from '../types';
import { SplitPaneRenderer } from './SplitPaneRenderer';
import { TerminalTabBar } from './TerminalTabBar';

/** Check if a split tree contains a pane with the given ID */
function treeContainsPane(node: SplitNode, paneId: string): boolean {
	if (node.type === 'leaf') return node.id === paneId;
	return treeContainsPane(node.children[0], paneId) || treeContainsPane(node.children[1], paneId);
}

/** Update ratio for a specific branch node, preserving references when unchanged */
function updateBranchRatio(node: SplitNode, nodeId: string, ratio: number): SplitNode {
	if (node.type === 'leaf') return node;
	if (node.id === nodeId) return { ...node, ratio };
	const c0 = updateBranchRatio(node.children[0], nodeId, ratio);
	const c1 = updateBranchRatio(node.children[1], nodeId, ratio);
	if (c0 === node.children[0] && c1 === node.children[1]) return node;
	return { ...node, children: [c0, c1] as [SplitNode, SplitNode] };
}

/** Recursively collect all pane IDs from a split tree */
function collectPaneIds(node: SplitNode): string[] {
	if (node.type === 'leaf') return [node.id];
	return [...collectPaneIds(node.children[0]), ...collectPaneIds(node.children[1])];
}

/** Recursively find and remove a pane from the tree, promoting siblings */
function removePaneFromTree(node: SplitNode, paneId: string): SplitNode | null {
	if (node.type === 'leaf') {
		return node.id === paneId ? null : node;
	}
	const newChild0 = removePaneFromTree(node.children[0], paneId);
	const newChild1 = removePaneFromTree(node.children[1], paneId);
	if (newChild0 === null) return newChild1;
	if (newChild1 === null) return newChild0;
	return { ...node, children: [newChild0, newChild1] };
}

/** Recursively collect all PTY session IDs from a split tree */
function collectPtySessionIds(node: SplitNode): string[] {
	if (node.type === 'leaf') return node.ptySessionId ? [node.ptySessionId] : [];
	return [...collectPtySessionIds(node.children[0]), ...collectPtySessionIds(node.children[1])];
}

// Module-level set — survives React Strict Mode double-mount (useRef resets between mounts)
const initedWindows = new Set<string>();

/**
 * Multi-tab terminal app with split panes.
 * Each tab has a recursive split tree of panes.
 * Each leaf pane has its own PTY session and xterm instance.
 *
 * Keyboard shortcuts (via attachCustomKeyEventHandler):
 * - Cmd+T: new tab
 * - Cmd+W: close active pane (or tab if last pane, or window if last tab)
 * - Cmd+D: split active pane vertically
 * - Cmd+Shift+D: split active pane horizontally
 * - Ctrl+Tab: next tab
 * - Ctrl+Shift+Tab: prev tab
 */
export function MultiTerminalApp(props: { windowId: string; meta?: Record<string, unknown> }) {
	const [tabs, setTabs] = useState<TerminalTab[]>([]);
	const [activeTabId, setActiveTabId] = useState<string>('');

	// Track whether init has run (prevents meta effect from clearing persisted state on mount)
	const initializedRef = useRef(false);

	// One-shot guard: publish event.metaUpdated once when PTY sessions first appear
	const metaPublishedRef = useRef(false);

	// Keep a ref to latest tabs for use in callbacks without stale closures
	const tabsRef = useRef(tabs);
	tabsRef.current = tabs;

	const updateWindowMeta = useWindowStore((s) => s.updateWindowMeta);
	const closeWindow = useWindowStore((s) => s.closeWindow);

	// Helper: create a new leaf node
	const createLeafNode = useCallback((): SplitNode => {
		return {
			type: 'leaf',
			id: uuid(),
			ptySessionId: null,
			cwd: null,
			lastCommand: null,
		};
	}, []);

	// Create a new tab
	const createTab = useCallback(() => {
		const leafNode = createLeafNode();
		const newTab: TerminalTab = {
			id: uuid(),
			ptySessionId: null, // legacy, kept for compatibility
			title: 'bash',
			cwd: null,
			lastCommand: null,
			splitTree: leafNode,
			focusedPaneId: leafNode.id,
		};
		setTabs((prev) => [...prev, newTab]);
		setActiveTabId(newTab.id);
		return newTab.id;
	}, [createLeafNode]);

	// Destroy PTY sessions directly via the NatsClient singleton (bypasses React hooks)
	const destroyPtySessions = useCallback((sessionIds: string[]) => {
		const client = getNatsClient();
		for (const sessionId of sessionIds) {
			client.publish(SUBJECTS.pty.destroy(client.orgId), { sessionId });
		}
	}, []);

	// Close the focused pane in the active tab (Cmd+W)
	const closePane = useCallback(() => {
		// Read snapshot for side effects (PTY destroy) only
		const activeTab = tabsRef.current.find((t) => t.id === activeTabId);
		if (!activeTab) return;

		const allPaneIds = collectPaneIds(activeTab.splitTree);

		// If only one pane, close the tab
		if (allPaneIds.length === 1) {
			const sessionIds = collectPtySessionIds(activeTab.splitTree);
			destroyPtySessions(sessionIds);

			setTabs((prev) => {
				const newTabs = prev.filter((t) => t.id !== activeTabId);

				if (newTabs.length === 0) {
					closeWindow(props.windowId);
					return newTabs;
				}

				const idx = prev.findIndex((t) => t.id === activeTabId);
				const nextIdx = idx > 0 ? idx - 1 : 0;
				setActiveTabId(newTabs[nextIdx].id);

				return newTabs;
			});
			return;
		}

		// Multiple panes — destroy the focused pane's PTY session (side effect from snapshot)
		const focusedLeaf = (function findLeaf(node: SplitNode): SplitNode | null {
			if (node.type === 'leaf') return node.id === activeTab.focusedPaneId ? node : null;
			return findLeaf(node.children[0]) || findLeaf(node.children[1]);
		})(activeTab.splitTree);
		if (focusedLeaf && focusedLeaf.type === 'leaf' && focusedLeaf.ptySessionId) {
			destroyPtySessions([focusedLeaf.ptySessionId]);
		}

		// Compute new tree from prev inside updater to avoid lost updates
		setTabs((prev) =>
			prev.map((t) => {
				if (t.id !== activeTabId) return t;
				const newTree = removePaneFromTree(t.splitTree, t.focusedPaneId);
				if (!newTree) return t;
				const newPaneIds = collectPaneIds(newTree);
				const newFocusedPaneId = newPaneIds[0] || newTree.id;
				return { ...t, splitTree: newTree, focusedPaneId: newFocusedPaneId };
			})
		);
	}, [activeTabId, destroyPtySessions, closeWindow, props.windowId]);

	// Close a specific tab by ID (tab X button)
	const closeTab = useCallback(
		(tabId: string) => {
			const tab = tabsRef.current.find((t) => t.id === tabId);
			if (!tab) return;

			const sessionIds = collectPtySessionIds(tab.splitTree);
			destroyPtySessions(sessionIds);

			setTabs((prev) => {
				const newTabs = prev.filter((t) => t.id !== tabId);

				if (newTabs.length === 0) {
					closeWindow(props.windowId);
					return newTabs;
				}

				if (tabId === activeTabId) {
					const idx = prev.findIndex((t) => t.id === tabId);
					const nextIdx = idx > 0 ? idx - 1 : 0;
					setActiveTabId(newTabs[nextIdx].id);
				}

				return newTabs;
			});
		},
		[activeTabId, destroyPtySessions, closeWindow, props.windowId]
	);

	// Helper: split a pane in the tree
	const splitPaneInTree = useCallback(
		(node: SplitNode, paneId: string, direction: 'horizontal' | 'vertical'): SplitNode => {
			if (node.type === 'leaf') {
				if (node.id === paneId) {
					const newLeaf = createLeafNode();
					return {
						type: 'branch',
						id: uuid(),
						direction,
						children: [node, newLeaf],
						ratio: 0.5,
					};
				}
				return node;
			}

			return {
				...node,
				children: [
					splitPaneInTree(node.children[0], paneId, direction),
					splitPaneInTree(node.children[1], paneId, direction),
				] as [SplitNode, SplitNode],
			};
		},
		[createLeafNode]
	);

	// Split the focused pane — tree computed inside updater to avoid lost updates
	const splitPane = useCallback(
		(direction: 'horizontal' | 'vertical') => {
			setTabs((prev) => {
				const activeTab = prev.find((t) => t.id === activeTabId);
				if (!activeTab) return prev;
				const newTree = splitPaneInTree(activeTab.splitTree, activeTab.focusedPaneId, direction);
				return prev.map((t) => (t.id === activeTabId ? { ...t, splitTree: newTree } : t));
			});
		},
		[activeTabId, splitPaneInTree]
	);

	// Switch to next tab (Ctrl+Tab)
	const nextTab = useCallback(() => {
		const current = tabsRef.current;
		if (current.length === 0) return;
		const idx = current.findIndex((t) => t.id === activeTabId);
		const nextIdx = (idx + 1) % current.length;
		setActiveTabId(current[nextIdx].id);
	}, [activeTabId]);

	// Switch to previous tab (Ctrl+Shift+Tab)
	const prevTab = useCallback(() => {
		const current = tabsRef.current;
		if (current.length === 0) return;
		const idx = current.findIndex((t) => t.id === activeTabId);
		const nextIdx = idx === 0 ? current.length - 1 : idx - 1;
		setActiveTabId(current[nextIdx].id);
	}, [activeTabId]);

	// Initialize: restore from meta or create new tab.
	// Uses module-level `initedWindows` set instead of useRef to survive React
	// Strict Mode double-mount (refs reset between mounts, module state doesn't).
	// Reads meta from the Zustand store directly (not props.meta) because
	// updateWindowMeta writes via queueMicrotask which may not have flushed.
	useEffect(() => {
		if (tabs.length > 0 || initedWindows.has(props.windowId)) return;

		const win = useWindowStore
			.getState()
			.getWindows()
			.find((w) => w.id === props.windowId);
		const meta = win?.meta;

		// Synced window — wait for meta with PTY sessions to arrive
		if (meta?._awaitingMeta) return;

		initedWindows.add(props.windowId);

		if (meta?.tabs && Array.isArray(meta.tabs) && meta.tabs.length > 0) {
			const seen = new Set<string>();
			const uniqueTabs = (meta.tabs as TerminalTab[]).filter((tab) => {
				if (seen.has(tab.id)) return false;
				seen.add(tab.id);
				return true;
			});
			setTabs(uniqueTabs);
			setActiveTabId((meta.activeTabId as string) || uniqueTabs[0].id);
		} else {
			createTab();
		}
		initializedRef.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Run once on mount

	// Clear initedWindows when the window is truly closed (not during Strict Mode remount).
	// On Strict Mode remount the window still exists in the store, so we keep the guard.
	useEffect(() => {
		const wid = props.windowId;
		return () => {
			const exists = useWindowStore
				.getState()
				.getWindows()
				.some((w) => w.id === wid);
			if (!exists) initedWindows.delete(wid);
		};
	}, [props.windowId]);

	// Watch for remote meta arrival (cross-tab PTY sharing)
	useEffect(() => {
		if (initializedRef.current || tabs.length > 0) return;

		const unsub = useWindowStore.subscribe((state) => {
			if (initializedRef.current) return;
			const win = state.getWindows().find((w) => w.id === props.windowId);
			if (!win?.meta?.tabs || !Array.isArray(win.meta.tabs)) return;
			if (win.meta._awaitingMeta) return;

			// Ensure at least one tab has a real PTY session (not null)
			const metaTabs = win.meta.tabs as TerminalTab[];
			const hasSession = metaTabs.some((t) => collectPtySessionIds(t.splitTree).length > 0);
			if (!hasSession) return;

			// Meta arrived with PTY sessions — initialize from shared sessions
			initedWindows.add(props.windowId);
			const seen = new Set<string>();
			const uniqueTabs = metaTabs.filter((tab) => {
				if (seen.has(tab.id)) return false;
				seen.add(tab.id);
				return true;
			});
			setTabs(uniqueTabs);
			setActiveTabId((win.meta.activeTabId as string) || uniqueTabs[0].id);
			initializedRef.current = true;
		});

		return unsub;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.windowId]);

	// Timeout fallback: create fresh tabs if synced meta doesn't arrive in 3s
	useEffect(() => {
		if (initializedRef.current || tabs.length > 0) return;

		const win = useWindowStore
			.getState()
			.getWindows()
			.find((w) => w.id === props.windowId);
		if (!win?.meta?._awaitingMeta) return;

		const timeout = setTimeout(() => {
			if (initializedRef.current || tabsRef.current.length > 0) return;
			initedWindows.add(props.windowId);
			createTab();
			initializedRef.current = true;
		}, 3000);

		return () => clearTimeout(timeout);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.windowId]);

	// Handle pane focus
	const handlePaneFocus = useCallback((paneId: string) => {
		setTabs((prev) =>
			prev.map((t) => {
				if (!treeContainsPane(t.splitTree, paneId)) return t;

				const findPaneData = (node: SplitNode): { cwd: string | null; lastCommand: string | null } | null => {
					if (node.type === 'leaf') {
						return node.id === paneId ? { cwd: node.cwd, lastCommand: node.lastCommand } : null;
					}
					return findPaneData(node.children[0]) || findPaneData(node.children[1]);
				};

				const paneData = findPaneData(t.splitTree);

				return {
					...t,
					focusedPaneId: paneId,
					cwd: paneData?.cwd ?? t.cwd,
					lastCommand: paneData?.lastCommand ?? t.lastCommand,
				};
			})
		);
	}, []);

	// Handle session ID change for a pane
	const handleSessionIdChange = useCallback((paneId: string, sessionId: string) => {
		setTabs((prev) =>
			prev.map((t) => {
				if (!treeContainsPane(t.splitTree, paneId)) return t;

				const updateSessionId = (node: SplitNode): SplitNode => {
					if (node.type === 'leaf') {
						return node.id === paneId ? { ...node, ptySessionId: sessionId } : node;
					}
					return {
						...node,
						children: [updateSessionId(node.children[0]), updateSessionId(node.children[1])] as [SplitNode, SplitNode],
					};
				};

				return {
					...t,
					splitTree: updateSessionId(t.splitTree),
				};
			})
		);
	}, []);

	// Handle CWD change for a pane (OSC 7)
	const handleCwdChange = useCallback((paneId: string, cwd: string) => {
		setTabs((prev) =>
			prev.map((t) => {
				if (!treeContainsPane(t.splitTree, paneId)) return t;

				const updateCwd = (node: SplitNode): SplitNode => {
					if (node.type === 'leaf') {
						return node.id === paneId ? { ...node, cwd } : node;
					}
					return {
						...node,
						children: [updateCwd(node.children[0]), updateCwd(node.children[1])] as [SplitNode, SplitNode],
					};
				};

				const newTree = updateCwd(t.splitTree);
				const newCwd = t.focusedPaneId === paneId ? cwd : t.cwd;

				return {
					...t,
					splitTree: newTree,
					cwd: newCwd,
				};
			})
		);
	}, []);

	// Handle last command change for a pane
	const handleLastCommandChange = useCallback((paneId: string, command: string) => {
		setTabs((prev) =>
			prev.map((t) => {
				if (!treeContainsPane(t.splitTree, paneId)) return t;

				const updateLastCommand = (node: SplitNode): SplitNode => {
					if (node.type === 'leaf') {
						return node.id === paneId ? { ...node, lastCommand: command } : node;
					}
					return {
						...node,
						children: [updateLastCommand(node.children[0]), updateLastCommand(node.children[1])] as [
							SplitNode,
							SplitNode,
						],
					};
				};

				const newTree = updateLastCommand(t.splitTree);
				const newLastCommand = t.focusedPaneId === paneId ? command : t.lastCommand;

				return {
					...t,
					splitTree: newTree,
					lastCommand: newLastCommand,
				};
			})
		);
	}, []);

	// Handle ratio change for a branch node
	const handleRatioChange = useCallback((nodeId: string, ratio: number) => {
		setTabs((prev) =>
			prev.map((t) => {
				const newTree = updateBranchRatio(t.splitTree, nodeId, ratio);
				return newTree === t.splitTree ? t : { ...t, splitTree: newTree };
			})
		);
	}, []);

	// Keyboard shortcut handler
	const handleKeyboardShortcut = useCallback(
		(event: KeyboardEvent): boolean => {
			const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
			const cmdKey = isMac ? event.metaKey : event.ctrlKey;

			// Cmd+T: new tab
			if (cmdKey && event.key === 't' && !event.shiftKey && !event.altKey) {
				event.preventDefault();
				createTab();
				return false;
			}

			// Cmd+W: close pane
			if (cmdKey && event.key === 'w' && !event.shiftKey && !event.altKey) {
				event.preventDefault();
				closePane();
				return false;
			}

			// Cmd+D: split vertical
			if (cmdKey && event.key === 'd' && !event.shiftKey && !event.altKey) {
				event.preventDefault();
				splitPane('vertical');
				return false;
			}

			// Cmd+Shift+D: split horizontal
			if (cmdKey && event.key === 'D' && event.shiftKey && !event.altKey) {
				event.preventDefault();
				splitPane('horizontal');
				return false;
			}

			// Ctrl+Tab: next tab (terminal-internal only)
			if (event.ctrlKey && event.key === 'Tab' && !event.shiftKey && !event.metaKey) {
				event.preventDefault();
				nextTab();
				return false;
			}

			// Ctrl+Shift+Tab: prev tab
			if (event.ctrlKey && event.key === 'Tab' && event.shiftKey && !event.metaKey) {
				event.preventDefault();
				prevTab();
				return false;
			}

			// Let xterm handle everything else
			return true;
		},
		[createTab, closePane, splitPane, nextTab, prevTab]
	);

	// Update window meta when tabs change (deferred to avoid updating store during commit phase)
	useEffect(() => {
		if (!initializedRef.current || tabs.length === 0) return;

		// One-shot: publish event.metaUpdated directly via NATS when PTY sessions
		// first become available. This enables cross-tab PTY session sharing —
		// other tabs waiting for sessions can reattach instead of creating new ones.
		if (!metaPublishedRef.current) {
			const sessionIds = tabs.flatMap((t) => collectPtySessionIds(t.splitTree));
			if (sessionIds.length > 0) {
				metaPublishedRef.current = true;
				const client = getNatsClient();
				if (client.userId) {
					client.publish(SUBJECTS.desktop.event.metaUpdated(client.orgId, client.userId), {
						windowId: props.windowId,
						meta: { tabs, activeTabId },
					});
				}
			}
		}

		queueMicrotask(() => {
			updateWindowMeta(props.windowId, { tabs, activeTabId });
		});
	}, [tabs, activeTabId, props.windowId, updateWindowMeta]);

	// Collect all session IDs from current tabs ref
	const collectAllSessionIds = useCallback(() => {
		return tabsRef.current.flatMap((tab) => collectPtySessionIds(tab.splitTree));
	}, []);

	// Watch for window closing flag (set by closeWindow from the X button).
	// Uses a zustand store subscription so it fires synchronously — before the
	// microtask that removes the window and unmounts the component.
	useEffect(() => {
		const unsub = useWindowStore.subscribe((state, prevState) => {
			const wsId = state.activeWorkspaceId;
			if (!wsId) return;
			const win = (state.windowsByWorkspace[wsId] || []).find((w) => w.id === props.windowId);
			const prevWin = (prevState.windowsByWorkspace[wsId] || []).find((w) => w.id === props.windowId);
			if (win?.closing && !prevWin?.closing) {
				destroyPtySessions(collectAllSessionIds());
			}
		});
		return unsub;
	}, [props.windowId, destroyPtySessions, collectAllSessionIds]);

	return (
		<div
			className="h-full w-full flex flex-col"
			style={{ background: 'var(--os-terminal-bg, var(--os-surface-sunken))' }}
		>
			<TerminalTabBar
				tabs={tabs}
				activeTabId={activeTabId}
				onTabClick={setActiveTabId}
				onTabClose={closeTab}
				onNewTab={createTab}
			/>
			<div data-no-drag className="flex-1 overflow-hidden relative">
				{tabs.map((tab) => (
					<div
						key={tab.id}
						className="absolute inset-0"
						style={{ visibility: tab.id === activeTabId ? 'visible' : 'hidden' }}
					>
						<SplitPaneRenderer
							node={tab.splitTree}
							focusedPaneId={tab.id === activeTabId ? tab.focusedPaneId : ''}
							onPaneFocus={handlePaneFocus}
							onSessionIdChange={handleSessionIdChange}
							onKeyboardShortcut={handleKeyboardShortcut}
							onRatioChange={handleRatioChange}
							onCwdChange={handleCwdChange}
							onLastCommandChange={handleLastCommandChange}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
