import { AnimatePresence } from 'motion/react';
import type React from 'react';
import { Suspense } from 'react';
import { useIsMobile } from '../lib/hooks/use-is-mobile';
import { useWindowStore } from '../stores/window-store';
import { AppErrorBoundary } from './window/AppErrorBoundary';
import { AppWindowTabs } from './window/AppWindowTabs';
import { BundleLoadingSpinner } from './window/BundleLoadingSpinner';
import { MobileWindowStack } from './window/MobileWindowStack';
import { Window } from './window/Window';

/**
 * Render function type for app components.
 * Consumers must provide this to map appId -> React component.
 */
export interface AppComponentRenderer {
	getComponent: (appId: string) => React.ComponentType<{ windowId: string; meta?: Record<string, unknown> }> | null;
	getManifest: (appId: string) =>
		| {
				label: string;
				showTabs?: boolean;
				fullSizeContent?: boolean;
				storeMeta?: { name: string; version: string; author: string; description: string; permissions?: string[] };
				minRole?: string;
				natsPrefix?: string;
				permission?: string;
		  }
		| undefined;
}

/** Context to provide app rendering capabilities from the consumer. */
let _appRenderer: AppComponentRenderer | null = null;

export function setAppRenderer(renderer: AppComponentRenderer) {
	_appRenderer = renderer;
}

export function getAppRenderer(): AppComponentRenderer | null {
	return _appRenderer;
}

export function WindowRenderer() {
	const windowsByWorkspace = useWindowStore((s) => s.windowsByWorkspace);
	const activeWorkspaceId = useWindowStore((s) => s.activeWorkspaceId);
	const windows = activeWorkspaceId ? windowsByWorkspace[activeWorkspaceId] || [] : [];

	// biome-ignore lint/suspicious/noConsole: debug logging for window renderer
	console.log(`[WindowRenderer] workspace: ${activeWorkspaceId}, windows: ${windows.length}`);

	const isMobile = useIsMobile();
	const renderer = getAppRenderer();

	if (isMobile) {
		return <MobileWindowStack windows={windows} />;
	}

	return (
		<AnimatePresence>
			{windows.map((win) => {
				const AppComponent = renderer?.getComponent(win.appId);
				if (!AppComponent) return null;

				const manifest = renderer?.getManifest(win.appId);
				const appContent = (
					<Suspense fallback={<BundleLoadingSpinner appName={manifest?.label ?? win.appId} />}>
						<AppComponent windowId={win.id} meta={win.meta} />
					</Suspense>
				);

				return (
					<Window key={win.id} window={win}>
						{manifest?.showTabs ? (
							<AppWindowTabs appId={win.appId} manifest={manifest}>
								{appContent}
							</AppWindowTabs>
						) : (
							<AppErrorBoundary appName={manifest?.label ?? win.appId}>{appContent}</AppErrorBoundary>
						)}
					</Window>
				);
			})}
		</AnimatePresence>
	);
}
