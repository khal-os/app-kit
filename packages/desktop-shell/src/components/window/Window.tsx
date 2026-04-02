import { WindowActiveProvider, WindowMinimizedProvider } from '@khal-os/ui';
import { motion } from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { TASKBAR_HEIGHT } from '../../lib/constants';
import { useWindowStore } from '../../stores/window-store';
import type { SnapZone, WindowState } from '../../types/window';
import { getAppRenderer } from '../WindowRenderer';
import { SnapPreview } from './SnapPreview';
import { WindowContent } from './WindowContent';
import { WindowControlsOverlay } from './WindowControlsOverlay';
import { WindowFrame } from './WindowFrame';

/** LP hero easing curve -- smooth decel with slight overshoot feel. */
const KHAL_EASE = [0.22, 1, 0.36, 1] as const;

/** Walk up the DOM from target, return true if any ancestor has [data-no-drag]. */
function hasNoDragAncestor(target: EventTarget | null, boundary: HTMLElement | null): boolean {
	let el = target as HTMLElement | null;
	while (el && el !== boundary) {
		if (el.dataset?.noDrag !== undefined) return true;
		el = el.parentElement;
	}
	return false;
}

interface WindowProps {
	window: WindowState;
	children: React.ReactNode;
}
const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;
const SNAP_THRESHOLD = 8;
const CORNER_SIZE = 80;

const RESIZE_EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
const CURSOR_MAP: Record<string, string> = {
	n: 'cursor-n-resize',
	s: 'cursor-s-resize',
	e: 'cursor-e-resize',
	w: 'cursor-w-resize',
	ne: 'cursor-ne-resize',
	nw: 'cursor-nw-resize',
	se: 'cursor-se-resize',
	sw: 'cursor-sw-resize',
};
const EDGE_STYLE: Record<string, React.CSSProperties> = {
	n: { top: -3, left: 4, right: 4, height: 6 },
	s: { bottom: -3, left: 4, right: 4, height: 6 },
	e: { right: -3, top: 4, bottom: 4, width: 6 },
	w: { left: -3, top: 4, bottom: 4, width: 6 },
	ne: { top: -3, right: -3, width: 12, height: 12 },
	nw: { top: -3, left: -3, width: 12, height: 12 },
	se: { bottom: -3, right: -3, width: 12, height: 12 },
	sw: { bottom: -3, left: -3, width: 12, height: 12 },
};

function detectSnapZone(clientX: number, clientY: number): SnapZone {
	const vw = window.innerWidth;
	const vh = window.innerHeight - TASKBAR_HEIGHT;
	const nearLeft = clientX <= SNAP_THRESHOLD;
	const nearRight = clientX >= vw - SNAP_THRESHOLD;
	const nearTop = clientY <= SNAP_THRESHOLD;
	const nearBottom = clientY >= vh - SNAP_THRESHOLD;

	if (nearLeft && clientY < CORNER_SIZE) return 'top-left';
	if (nearLeft && clientY > vh - CORNER_SIZE) return 'bottom-left';
	if (nearRight && clientY < CORNER_SIZE) return 'top-right';
	if (nearRight && clientY > vh - CORNER_SIZE) return 'bottom-right';
	if (nearLeft) return 'left';
	if (nearRight) return 'right';
	if (nearTop && clientX < CORNER_SIZE) return 'top-left';
	if (nearTop && clientX > vw - CORNER_SIZE) return 'top-right';
	if (nearTop) return 'top';
	if (nearBottom && clientX < CORNER_SIZE) return 'bottom-left';
	if (nearBottom && clientX > vw - CORNER_SIZE) return 'bottom-right';
	return null;
}

function computeResize(
	orig: { origW: number; origH: number; origX: number; origY: number; edge: string },
	dx: number,
	dy: number
) {
	const { origW, origH, origX, origY, edge } = orig;
	let newW = origW;
	let newH = origH;
	let newX = origX;
	let newY = origY;

	if (edge.includes('e')) newW = Math.max(MIN_WIDTH, origW + dx);
	if (edge.includes('s')) newH = Math.max(MIN_HEIGHT, origH + dy);
	if (edge.includes('w')) {
		newW = Math.max(MIN_WIDTH, origW - dx);
		if (newW !== MIN_WIDTH) newX = origX + dx;
	}
	if (edge.includes('n')) {
		newH = Math.max(MIN_HEIGHT, origH - dy);
		if (newH !== MIN_HEIGHT) newY = Math.max(0, origY + dy);
	}

	return { newW, newH, newX, newY };
}

export function Window({ window: win, children }: WindowProps) {
	const windowRef = useRef<HTMLElement>(null);
	const focusWindow = useWindowStore((s) => s.focusWindow);
	const moveWindow = useWindowStore((s) => s.moveWindow);
	const resizeWindow = useWindowStore((s) => s.resizeWindow);
	const snapWindow = useWindowStore((s) => s.snapWindow);
	const unsnapWindow = useWindowStore((s) => s.unsnapWindow);
	const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
	const [snapPreview, setSnapPreview] = useState<SnapZone>(null);
	const [_settingsPanelOpen, _setSettingsPanelOpen] = useState(false);
	const dragRef = useRef<{
		startX: number;
		startY: number;
		origX: number;
		origY: number;
		wasSnapped: boolean;
		preSnapW: number;
		preSnapH: number;
	} | null>(null);
	const resizeRef = useRef<{
		startX: number;
		startY: number;
		origW: number;
		origH: number;
		origX: number;
		origY: number;
		edge: string;
	} | null>(null);

	const restoreWindow = useWindowStore((s) => s.restoreWindow);

	const renderer = getAppRenderer();
	const isFullSizeContent = !!renderer?.getManifest(win.appId)?.fullSizeContent;

	// When restoring from minimized, remove visibility:hidden before the
	// restore animation renders its first frame.
	useLayoutEffect(() => {
		const el = windowRef.current;
		if (!el) return;
		if (!win.minimized) {
			el.style.visibility = '';
		}
	}, [win.minimized]);

	const handleTitleBarPointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			focusWindow(win.id);

			const el = windowRef.current;
			if (!el) return;

			const wasSnapped = !!win.snapped;
			const wasMaximized = win.maximized;
			const preSnapW = win.preSnapSize?.width ?? win.size.width;
			const preSnapH = win.preSnapSize?.height ?? win.size.height;

			if (wasMaximized) {
				restoreWindow(win.id);
			} else if (wasSnapped) {
				unsnapWindow(win.id);
			}

			dragRef.current = {
				startX: e.clientX,
				startY: e.clientY,
				origX: wasSnapped || wasMaximized ? e.clientX - preSnapW / 2 : win.position.x,
				origY: wasSnapped || wasMaximized ? e.clientY - 20 : win.position.y,
				wasSnapped,
				preSnapW,
				preSnapH,
			};

			if (wasSnapped || wasMaximized) {
				moveWindow(win.id, {
					x: dragRef.current.origX,
					y: dragRef.current.origY,
				});
			}

			// GPU-accelerated drag: use transform instead of updating store per frame
			el.style.willChange = 'transform';
			document.body.style.userSelect = 'none';
			let lastZone: SnapZone = null;

			const onMove = (ev: PointerEvent) => {
				if (!dragRef.current) return;
				const dx = ev.clientX - dragRef.current.startX;
				const dy = ev.clientY - dragRef.current.startY;
				const clampedDy = Math.max(-dragRef.current.origY, dy);

				// Direct DOM -- zero React re-renders during drag
				el.style.transform = `translate(${dx}px,${clampedDy}px)`;

				const zone = detectSnapZone(ev.clientX, ev.clientY);
				if (zone !== lastZone) {
					lastZone = zone;
					setSnapPreview(zone);
				}
			};

			const onUp = (ev: PointerEvent) => {
				document.removeEventListener('pointermove', onMove);
				document.removeEventListener('pointerup', onUp);
				document.body.style.userSelect = '';

				if (!dragRef.current) return;

				const dx = ev.clientX - dragRef.current.startX;
				const dy = ev.clientY - dragRef.current.startY;
				const finalX = dragRef.current.origX + dx;
				const finalY = Math.max(0, dragRef.current.origY + dy);

				// Commit to DOM first to avoid flash, then clear transform
				el.style.left = `${finalX}px`;
				el.style.top = `${finalY}px`;
				el.style.transform = '';
				el.style.willChange = '';

				dragRef.current = null;

				const zone = detectSnapZone(ev.clientX, ev.clientY);
				setSnapPreview(null);
				if (zone === 'top') {
					maximizeWindow(win.id);
				} else if (zone) {
					moveWindow(win.id, { x: finalX, y: finalY });
					snapWindow(win.id, zone);
				} else {
					moveWindow(win.id, { x: finalX, y: finalY });
				}
			};

			document.addEventListener('pointermove', onMove);
			document.addEventListener('pointerup', onUp);
		},
		[
			win.id,
			win.position,
			win.size,
			win.maximized,
			win.snapped,
			win.preSnapSize,
			focusWindow,
			moveWindow,
			snapWindow,
			unsnapWindow,
			maximizeWindow,
			restoreWindow,
		]
	);

	const handleTitleBarDoubleClick = useCallback(() => {
		if (win.snapped) {
			unsnapWindow(win.id);
		} else {
			maximizeWindow(win.id);
		}
	}, [win.id, win.snapped, unsnapWindow, maximizeWindow]);

	/** Drag handler for fullSizeContent windows: skips drag if target has data-no-drag ancestor. */
	const handleFullSizeDragPointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (hasNoDragAncestor(e.target, windowRef.current)) return;
			handleTitleBarPointerDown(e);
		},
		[handleTitleBarPointerDown]
	);

	/** Double-click handler for fullSizeContent windows: skips if target has data-no-drag ancestor. */
	const handleFullSizeDragDoubleClick = useCallback(
		(e: React.MouseEvent) => {
			if (hasNoDragAncestor(e.target, windowRef.current)) return;
			handleTitleBarDoubleClick();
		},
		[handleTitleBarDoubleClick]
	);

	const handleResizePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (win.maximized) return;
			const edge = (e.currentTarget as HTMLElement).dataset.edge!;
			e.preventDefault();
			e.stopPropagation();
			focusWindow(win.id);

			const el = windowRef.current;
			if (!el) return;

			if (win.snapped) {
				unsnapWindow(win.id);
			}

			resizeRef.current = {
				startX: e.clientX,
				startY: e.clientY,
				origW: win.size.width,
				origH: win.size.height,
				origX: win.position.x,
				origY: win.position.y,
				edge,
			};

			document.body.style.userSelect = 'none';

			const onMove = (ev: PointerEvent) => {
				if (!resizeRef.current) return;
				const dx = ev.clientX - resizeRef.current.startX;
				const dy = ev.clientY - resizeRef.current.startY;
				const { newW, newH, newX, newY } = computeResize(resizeRef.current, dx, dy);

				// Direct DOM -- zero React re-renders during resize
				el.style.width = `${newW}px`;
				el.style.height = `${newH}px`;
				el.style.left = `${newX}px`;
				el.style.top = `${newY}px`;
			};

			const onUp = (ev: PointerEvent) => {
				document.removeEventListener('pointermove', onMove);
				document.removeEventListener('pointerup', onUp);
				document.body.style.userSelect = '';

				if (!resizeRef.current) return;
				const dx = ev.clientX - resizeRef.current.startX;
				const dy = ev.clientY - resizeRef.current.startY;
				const { newW, newH, newX, newY } = computeResize(resizeRef.current, dx, dy);

				resizeRef.current = null;

				// Single store update on release
				resizeWindow(win.id, { width: newW, height: newH });
				moveWindow(win.id, { x: newX, y: newY });
			};

			document.addEventListener('pointermove', onMove);
			document.addEventListener('pointerup', onUp);
		},
		[win.id, win.position, win.size, win.maximized, win.snapped, focusWindow, resizeWindow, moveWindow, unsnapWindow]
	);

	const isSnapped = !!win.snapped;
	const isFullscreen = win.maximized;
	const style: React.CSSProperties = isFullscreen
		? {
				top: 0,
				left: 0,
				width: '100%',
				height: `calc(100% - ${TASKBAR_HEIGHT}px)`,
				zIndex: win.zIndex,
			}
		: {
				top: win.position.y,
				left: win.position.x,
				width: win.size.width,
				height: win.size.height,
				zIndex: win.zIndex,
			};

	// Minimized windows stay mounted (terminal, WebSocket connections stay alive).
	if (win.minimized) {
		style.pointerEvents = 'none';
		style.zIndex = -1;
	}

	const edgeless = isSnapped || isFullscreen;

	return (
		<>
			<motion.section
				ref={windowRef}
				layout={false}
				initial={{ opacity: 0, scale: 0.96, y: 24, filter: 'blur(4px)' }}
				animate={
					win.minimized
						? { opacity: 0, scale: 0.8, filter: 'blur(4px)', transition: { duration: 0.25, ease: KHAL_EASE } }
						: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: KHAL_EASE } }
				}
				exit={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(4px)', transition: { duration: 0.3, ease: KHAL_EASE } }}
				onAnimationComplete={() => {
					if (win.minimized && windowRef.current) {
						windowRef.current.style.visibility = 'hidden';
					}
				}}
				className="absolute flex flex-col transition-shadow"
				style={{
					...style,
					borderRadius: edgeless ? 0 : 'var(--khal-window-radius, 8px)',
					overflow: edgeless ? 'hidden' : ('var(--khal-window-overflow, hidden)' as React.CSSProperties['overflow']),
					border: win.focused
						? 'var(--khal-window-border-focused-expr, 1px solid var(--khal-window-border-focused))'
						: 'var(--khal-window-border-expr, 1px solid var(--khal-window-border))',
					boxShadow: win.focused ? 'var(--khal-window-shadow-focused)' : 'var(--khal-window-shadow)',
					background: 'var(--khal-window-bg, var(--khal-surface-default))',
					backdropFilter: 'var(--khal-window-backdrop, var(--khal-glass-filter, none))',
					WebkitBackdropFilter: 'var(--khal-window-backdrop, var(--khal-glass-filter, none))',
					transition: isSnapped ? 'none' : undefined,
				}}
				onPointerDown={() => focusWindow(win.id)}
				onFocus={() => focusWindow(win.id)}
				role="dialog"
				aria-label={`${win.title} window`}
				tabIndex={0}
			>
				<WindowActiveProvider value={!!win.focused}>
					<WindowMinimizedProvider value={!!win.minimized}>
						<div className="relative z-10 flex flex-1 flex-col overflow-hidden">
							{isFullSizeContent ? (
								<>
									<WindowControlsOverlay window={win} />
									<div
										className="flex flex-1 flex-col overflow-hidden"
										onPointerDown={handleFullSizeDragPointerDown}
										onDoubleClick={handleFullSizeDragDoubleClick}
									>
										{children}
									</div>
								</>
							) : (
								<>
									<WindowFrame
										window={win}
										onPointerDownTitleBar={handleTitleBarPointerDown}
										onDoubleClickTitleBar={handleTitleBarDoubleClick}
									/>
									<WindowContent>{children}</WindowContent>
								</>
							)}
						</div>
					</WindowMinimizedProvider>
				</WindowActiveProvider>

				{!isFullscreen &&
					!isSnapped &&
					RESIZE_EDGES.map((edge) => (
						<div
							key={edge}
							data-edge={edge}
							className={`absolute z-20 ${CURSOR_MAP[edge]}`}
							style={EDGE_STYLE[edge]}
							onPointerDown={handleResizePointerDown}
							aria-hidden="true"
						/>
					))}
			</motion.section>

			<SnapPreview zone={snapPreview} />
		</>
	);
}
