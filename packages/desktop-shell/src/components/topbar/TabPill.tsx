import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesktopTab } from '../../stores/tab-store';
import { useTabStore } from '../../stores/tab-store';
import { useWindowStore } from '../../stores/window-store';
import { TabContextMenu } from './TabContextMenu';

/* -- Pop-out helper -- */

const CASCADE_STEP = 30;

/**
 * Transfer all windows from a tab's workspace into the currently active workspace
 * as floating (non-maximized) windows, then remove the tab.
 */
export function popOutTab(tabId: string): void {
	const windowStore = useWindowStore.getState();
	const tabStore = useTabStore.getState();

	// Can't pop out the last tab
	if (tabStore.tabs.length <= 1) return;

	const activeId = tabStore.activeTabId;
	const windows = windowStore.windowsByWorkspace[tabId] || [];

	// If the tab being popped is the active one, we need to switch first
	// so that openWindow targets the right workspace.
	if (tabId === activeId) {
		// Find next tab to activate
		const idx = tabStore.tabs.findIndex((t) => t.id === tabId);
		const nextTab = tabStore.tabs[idx === 0 ? 1 : idx - 1];
		if (!nextTab) return;
		tabStore.setActiveTab(nextTab.id);
	}

	// Transfer each window to the (now) active workspace
	for (let i = 0; i < windows.length; i++) {
		const win = windows[i];
		windowStore.openWindow({
			title: win.title,
			appId: win.appId,
			width: win.size.width,
			height: win.size.height,
			x: 120 + i * CASCADE_STEP,
			y: 80 + i * CASCADE_STEP,
			meta: win.meta,
		});
	}

	// Remove the tab (which clears its workspace)
	tabStore.removeTab(tabId);
}

/* -- Drag constants -- */

const HORIZONTAL_THRESHOLD = 5;
const VERTICAL_POP_THRESHOLD = 40;

interface TabPillProps {
	tab: DesktopTab;
	isActive: boolean;
	/** Whether this is the only tab (can't close/pop-out last tab). */
	isOnly: boolean;
	onRequestClose: (tabId: string) => void;
}

export function TabPill({ tab, isActive, isOnly, onRequestClose }: TabPillProps) {
	const setActiveTab = useTabStore((s) => s.setActiveTab);
	const renameTab = useTabStore((s) => s.renameTab);
	const tabs = useTabStore((s) => s.tabs);

	const [editing, setEditing] = useState(false);
	const [editValue, setEditValue] = useState(tab.label);
	const inputRef = useRef<HTMLInputElement>(null);

	/* Context menu state */
	const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

	/* Drag state (ref to avoid re-renders during drag) */
	const dragRef = useRef<{
		startX: number;
		startY: number;
		dragging: false | 'reorder' | 'popout';
		tabEl: HTMLDivElement | null;
		initialOrder: string[];
		pillRects: { id: string; left: number; right: number; centerX: number }[];
	} | null>(null);

	const pillRef = useRef<HTMLDivElement>(null);
	const [dragOffsetX, setDragOffsetX] = useState(0);
	const [isDragging, setIsDragging] = useState(false);

	/* Focus input when entering edit mode */
	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	const commitRename = useCallback(() => {
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== tab.label) {
			renameTab(tab.id, trimmed);
		} else {
			setEditValue(tab.label);
		}
		setEditing(false);
	}, [editValue, tab.id, tab.label, renameTab]);

	const cancelRename = useCallback(() => {
		setEditValue(tab.label);
		setEditing(false);
	}, [tab.label]);

	const handleDoubleClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			setEditValue(tab.label);
			setEditing(true);
		},
		[tab.label]
	);

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				commitRename();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				cancelRename();
			}
		},
		[commitRename, cancelRename]
	);

	/* -- Mouse drag handling -- */

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			// Only left button, not when editing
			if (e.button !== 0 || editing) return;

			const startX = e.clientX;
			const startY = e.clientY;

			// Collect pill rects for reorder calculation
			const parent = pillRef.current?.parentElement;
			const pillRects: { id: string; left: number; right: number; centerX: number }[] = [];
			if (parent) {
				const children = parent.querySelectorAll<HTMLElement>('[data-tab-id]');
				for (const child of children) {
					const rect = child.getBoundingClientRect();
					pillRects.push({
						id: child.dataset.tabId || '',
						left: rect.left,
						right: rect.right,
						centerX: rect.left + rect.width / 2,
					});
				}
			}

			dragRef.current = {
				startX,
				startY,
				dragging: false,
				tabEl: pillRef.current,
				initialOrder: tabs.map((t) => t.id),
				pillRects,
			};

			const onMouseMove = (ev: MouseEvent) => {
				const drag = dragRef.current;
				if (!drag) return;

				const dx = ev.clientX - drag.startX;
				const dy = ev.clientY - drag.startY;

				if (!drag.dragging) {
					// Check threshold
					if (Math.abs(dy) >= VERTICAL_POP_THRESHOLD && !isOnly) {
						drag.dragging = 'popout';
					} else if (Math.abs(dx) >= HORIZONTAL_THRESHOLD) {
						drag.dragging = 'reorder';
						setIsDragging(true);
					} else {
						return;
					}
				}

				if (drag.dragging === 'popout') {
					// Pop out immediately
					cleanup();
					popOutTab(tab.id);
					return;
				}

				if (drag.dragging === 'reorder') {
					// Check vertical escape to pop-out
					if (dy >= VERTICAL_POP_THRESHOLD && !isOnly) {
						cleanup();
						setIsDragging(false);
						setDragOffsetX(0);
						popOutTab(tab.id);
						return;
					}

					setDragOffsetX(dx);

					// Determine new order based on cursor position
					const cursorX = ev.clientX;
					const newOrder = [...drag.initialOrder];
					const currentIdx = newOrder.indexOf(tab.id);
					if (currentIdx === -1) return;

					// Find which position the cursor is over
					let targetIdx = currentIdx;
					for (let i = 0; i < drag.pillRects.length; i++) {
						const pill = drag.pillRects[i];
						if (cursorX >= pill.left && cursorX <= pill.right) {
							targetIdx = i;
							break;
						}
					}

					if (targetIdx !== currentIdx) {
						// Move tab from currentIdx to targetIdx
						newOrder.splice(currentIdx, 1);
						newOrder.splice(targetIdx, 0, tab.id);
						useTabStore.getState().reorderTabs(newOrder);
						// Update initial order and rects after reorder
						drag.initialOrder = newOrder;
					}
				}
			};

			const onMouseUp = () => {
				cleanup();
				setIsDragging(false);
				setDragOffsetX(0);
			};

			const cleanup = () => {
				dragRef.current = null;
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
			};

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		},
		[editing, tabs, tab.id, isOnly]
	);

	/* -- Context menu -- */

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setCtxMenu({ x: e.clientX, y: e.clientY });
	}, []);

	const dismissCtxMenu = useCallback(() => {
		setCtxMenu(null);
	}, []);

	const handleCtxRename = useCallback(() => {
		setCtxMenu(null);
		setEditValue(tab.label);
		setEditing(true);
	}, [tab.label]);

	const handleCtxPopOut = useCallback(() => {
		setCtxMenu(null);
		popOutTab(tab.id);
	}, [tab.id]);

	const handleCtxClose = useCallback(() => {
		setCtxMenu(null);
		onRequestClose(tab.id);
	}, [tab.id, onRequestClose]);

	return (
		<>
			<div
				ref={pillRef}
				data-tab-id={tab.id}
				className="group relative flex items-center rounded-md transition-colors"
				style={{
					maxWidth: 160,
					background: isActive ? 'oklch(0.74 0.11 65 / 0.12)' : 'transparent',
					cursor: 'default',
					transform: isDragging ? `translateX(${dragOffsetX}px)` : undefined,
					transition: isDragging ? 'none' : undefined,
					zIndex: isDragging ? 100 : undefined,
					opacity: isDragging ? 0.85 : 1,
				}}
				onMouseDown={handleMouseDown}
				onContextMenu={handleContextMenu}
			>
				{/* Label / edit input */}
				<button
					type="button"
					onClick={() => setActiveTab(tab.id)}
					onDoubleClick={handleDoubleClick}
					className="rounded-md truncate transition-colors"
					style={{
						padding: '4px 12px',
						paddingRight: isOnly ? '12px' : '24px',
						fontSize: 12,
						lineHeight: '16px',
						fontWeight: isActive ? 500 : 400,
						background: 'transparent',
						color: isActive ? 'var(--khal-text-primary)' : 'var(--khal-text-secondary)',
						border: 'none',
						cursor: 'default',
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						display: editing ? 'none' : 'block',
					}}
				>
					{tab.label}
				</button>

				{editing && (
					<input
						ref={inputRef}
						type="text"
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={commitRename}
						onKeyDown={handleInputKeyDown}
						className="rounded-sm"
						style={{
							width: '100%',
							padding: '3px 8px',
							fontSize: 12,
							lineHeight: '16px',
							fontWeight: 500,
							background: 'rgba(255,255,255,0.1)',
							color: 'var(--khal-text-primary)',
							border: '1px solid oklch(0.74 0.11 65 / 0.3)',
							outline: 'none',
						}}
					/>
				)}

				{/* Close button -- hidden when it's the only tab */}
				{!isOnly && !editing && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onRequestClose(tab.id);
						}}
						className="absolute right-1 top-1/2 flex items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
						style={{
							transform: 'translateY(-50%)',
							width: 14,
							height: 14,
							fontSize: 10,
							lineHeight: 1,
							color: 'var(--khal-text-secondary)',
							background: 'transparent',
							border: 'none',
							cursor: 'default',
						}}
						aria-label={`Close ${tab.label}`}
					>
						&times;
					</button>
				)}
			</div>

			{/* Context menu (portal-like: rendered at body level via fixed positioning) */}
			{ctxMenu && (
				<TabContextMenu
					x={ctxMenu.x}
					y={ctxMenu.y}
					onRename={handleCtxRename}
					onPopOut={handleCtxPopOut}
					onClose={handleCtxClose}
					onDismiss={dismissCtxMenu}
					canRemove={!isOnly}
				/>
			)}
		</>
	);
}
