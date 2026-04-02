import { v4 as uuid } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SnapZone, WindowPosition, WindowSize, WindowState } from '../types/window';

interface WindowStore {
	windowsByWorkspace: Record<string, WindowState[]>;
	activeWorkspaceId: string | null;
	nextZIndex: number;

	getWindows: () => WindowState[];
	setActiveWorkspace: (id: string | null) => void;
	loadWindowState: (workspaceId: string, windows: WindowState[]) => void;

	openWindow: (opts: {
		title: string;
		appId: string;
		id?: string;
		width?: number;
		height?: number;
		x?: number;
		y?: number;
		meta?: Record<string, unknown>;
	}) => string;
	closeWindow: (id: string) => void;
	removeWindowImmediate: (id: string) => void;
	focusWindow: (id: string) => void;
	minimizeWindow: (id: string) => void;
	maximizeWindow: (id: string) => void;
	restoreWindow: (id: string) => void;
	moveWindow: (id: string, position: WindowPosition) => void;
	resizeWindow: (id: string, size: WindowSize) => void;
	snapWindow: (id: string, zone: SnapZone) => void;
	unsnapWindow: (id: string) => void;
	setWindowTitle: (id: string, title: string) => void;
	updateWindowMeta: (id: string, meta: Record<string, unknown>) => void;
	getTopmostWindow: () => WindowState | undefined;
	getSerializableState: (workspaceId?: string) => WindowState[];
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const CASCADE_OFFSET = 30;

function currentWindows(state: {
	windowsByWorkspace: Record<string, WindowState[]>;
	activeWorkspaceId: string | null;
}): WindowState[] {
	if (!state.activeWorkspaceId) return [];
	return state.windowsByWorkspace[state.activeWorkspaceId] || [];
}

function updateCurrentWindows(
	state: { windowsByWorkspace: Record<string, WindowState[]>; activeWorkspaceId: string | null },
	updater: (windows: WindowState[]) => WindowState[]
) {
	if (!state.activeWorkspaceId) return state.windowsByWorkspace;
	const current = state.windowsByWorkspace[state.activeWorkspaceId] || [];
	return {
		...state.windowsByWorkspace,
		[state.activeWorkspaceId]: updater(current),
	};
}

/** Find which workspace a window belongs to, regardless of activeWorkspaceId. */
function findWorkspaceForWindow(
	state: { windowsByWorkspace: Record<string, WindowState[]> },
	windowId: string
): string | null {
	for (const [wsId, windows] of Object.entries(state.windowsByWorkspace)) {
		if (windows.some((w) => w.id === windowId)) return wsId;
	}
	return null;
}

/** Apply an updater to the workspace that actually contains the given window. */
function updateWindowInPlace(
	state: { windowsByWorkspace: Record<string, WindowState[]> },
	windowId: string,
	updater: (windows: WindowState[]) => WindowState[]
): Record<string, WindowState[]> {
	const wsId = findWorkspaceForWindow(state, windowId);
	if (!wsId) return state.windowsByWorkspace;
	return {
		...state.windowsByWorkspace,
		[wsId]: updater(state.windowsByWorkspace[wsId]),
	};
}

export const useWindowStore = create<WindowStore>()(
	persist(
		(set, get) => ({
			windowsByWorkspace: {},
			activeWorkspaceId: null,
			nextZIndex: 1,

			getWindows: () => currentWindows(get()),

			setActiveWorkspace: (id) => {
				const prev = get().activeWorkspaceId;
				const wsByWs = get().windowsByWorkspace;
				// biome-ignore lint/suspicious/noConsole: debug logging for window store
				console.log(
					`[window-store] setActiveWorkspace: ${prev} -> ${id}`,
					Object.entries(wsByWs).map(([k, v]) => `${k}:${v.length}`)
				);
				set({ activeWorkspaceId: id });
			},

			loadWindowState: (workspaceId, windows) => {
				set((state) => ({
					windowsByWorkspace: {
						...state.windowsByWorkspace,
						[workspaceId]: windows,
					},
					nextZIndex: Math.max(state.nextZIndex, ...windows.map((w) => w.zIndex + 1), 1),
				}));
			},

			openWindow: (opts) => {
				const id = opts.id ?? uuid();
				// biome-ignore lint/suspicious/noConsole: debug logging for window store
				console.log(`[window-store] openWindow: ${opts.appId} -> workspace ${get().activeWorkspaceId}`, id);
				set((state) => {
					const windows = currentWindows(state);
					const cascade = windows.length * CASCADE_OFFSET;
					const z = state.nextZIndex;
					const win: WindowState = {
						id,
						title: opts.title,
						appId: opts.appId,
						position: {
							x: opts.x ?? 100 + (cascade % 300),
							y: opts.y ?? 100 + (cascade % 200),
						},
						size: {
							width: opts.width ?? DEFAULT_WIDTH,
							height: opts.height ?? DEFAULT_HEIGHT,
						},
						minimized: false,
						maximized: false,
						focused: true,
						zIndex: z,
						...(opts.meta && { meta: opts.meta }),
					};

					return {
						windowsByWorkspace: updateCurrentWindows(state, (ws) => [
							...ws.map((w) => ({ ...w, focused: false })),
							win,
						]),
						nextZIndex: z + 1,
					};
				});
				return id;
			},

			closeWindow: (id) => {
				const wsId = findWorkspaceForWindow(get(), id);
				if (!wsId) {
					// biome-ignore lint/suspicious/noConsole: debug logging for window store
					console.log(`[window-store] closeWindow: ${id} NOT FOUND in any workspace`);
					return;
				}
				const win = get().windowsByWorkspace[wsId]?.find((w) => w.id === id);
				// biome-ignore lint/suspicious/noConsole: debug logging for window store
				console.log(`[window-store] closeWindow: ${win?.appId} (${id}) in workspace ${wsId}`);

				// First, set closing flag so components can react
				set((state) => ({
					windowsByWorkspace: {
						...state.windowsByWorkspace,
						[wsId]: (state.windowsByWorkspace[wsId] || []).map((w) => (w.id === id ? { ...w, closing: true } : w)),
					},
				}));
				// Then remove on next tick to give components time to see the flag.
				// wsId is captured before the microtask so a workspace switch cannot misdirect it.
				queueMicrotask(() => {
					set((state) => ({
						windowsByWorkspace: {
							...state.windowsByWorkspace,
							[wsId]: (state.windowsByWorkspace[wsId] || []).filter((w) => w.id !== id),
						},
					}));
				});
			},

			removeWindowImmediate: (id) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) => ws.filter((w) => w.id !== id)),
				}));
			},

			focusWindow: (id) => {
				set((state) => {
					const z = state.nextZIndex;
					return {
						windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
							ws.map((w) =>
								w.id === id ? { ...w, focused: true, zIndex: z, minimized: false } : { ...w, focused: false }
							)
						),
						nextZIndex: z + 1,
					};
				});
			},

			minimizeWindow: (id) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => (w.id === id ? { ...w, minimized: true, focused: false } : w))
					),
				}));
			},

			maximizeWindow: (id) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => (w.id === id ? { ...w, maximized: true } : w))
					),
				}));
			},

			restoreWindow: (id) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => (w.id === id ? { ...w, maximized: false, minimized: false } : w))
					),
				}));
			},

			moveWindow: (id, position) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => (w.id === id ? { ...w, position } : w))
					),
				}));
			},

			resizeWindow: (id, size) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) => ws.map((w) => (w.id === id ? { ...w, size } : w))),
				}));
			},

			snapWindow: (id, zone) => {
				if (!zone) return;
				const TASKBAR_HEIGHT = 52;
				const vw = globalThis.innerWidth ?? 1280;
				const vh = (globalThis.innerHeight ?? 800) - TASKBAR_HEIGHT;
				const halfW = Math.round(vw / 2);
				const halfH = Math.round(vh / 2);

				const geometry: Record<NonNullable<SnapZone>, { x: number; y: number; w: number; h: number }> = {
					left: { x: 0, y: 0, w: halfW, h: vh },
					right: { x: halfW, y: 0, w: vw - halfW, h: vh },
					top: { x: 0, y: 0, w: vw, h: vh },
					'top-left': { x: 0, y: 0, w: halfW, h: halfH },
					'top-right': { x: halfW, y: 0, w: vw - halfW, h: halfH },
					'bottom-left': { x: 0, y: halfH, w: halfW, h: vh - halfH },
					'bottom-right': { x: halfW, y: halfH, w: vw - halfW, h: vh - halfH },
				};

				const g = geometry[zone];
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => {
							if (w.id !== id) return w;
							return {
								...w,
								snapped: zone,
								preSnapPosition: w.snapped ? w.preSnapPosition : w.position,
								preSnapSize: w.snapped ? w.preSnapSize : w.size,
								position: { x: g.x, y: g.y },
								size: { width: g.w, height: g.h },
								maximized: false,
							};
						})
					),
				}));
			},

			unsnapWindow: (id) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => {
							if (w.id !== id || !w.snapped) return w;
							return {
								...w,
								snapped: null,
								position: w.preSnapPosition ?? w.position,
								size: w.preSnapSize ?? w.size,
								preSnapPosition: undefined,
								preSnapSize: undefined,
							};
						})
					),
				}));
			},

			setWindowTitle: (id, title) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => (w.id === id ? { ...w, title } : w))
					),
				}));
			},

			updateWindowMeta: (id, meta) => {
				set((state) => ({
					windowsByWorkspace: updateWindowInPlace(state, id, (ws) =>
						ws.map((w) => (w.id === id ? { ...w, meta: { ...w.meta, ...meta } } : w))
					),
				}));
			},

			getTopmostWindow: () => {
				const windows = currentWindows(get());
				const visible = windows.filter((w) => !w.minimized);
				if (visible.length === 0) return undefined;
				return visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b));
			},

			getSerializableState: (workspaceId) => {
				const id = workspaceId || get().activeWorkspaceId;
				if (!id) return [];
				return get().windowsByWorkspace[id] || [];
			},
		}),
		{
			name: 'khal-windows',
			version: 1,
			partialize: (state) => ({
				windowsByWorkspace: Object.fromEntries(
					Object.entries(state.windowsByWorkspace).map(([workspace, windows]) => [
						workspace,
						windows.filter((w) => !w.closing).map(({ closing: _, ...rest }) => rest),
					])
				),
				activeWorkspaceId: state.activeWorkspaceId,
				nextZIndex: state.nextZIndex,
			}),
		}
	)
);
