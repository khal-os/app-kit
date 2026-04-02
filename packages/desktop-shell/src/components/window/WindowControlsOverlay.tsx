import { usePlatform } from '../../lib/platform';
import { useWindowStore } from '../../stores/window-store';
import type { WindowState } from '../../types/window';
import { TrafficLights } from './TrafficLights';
import { WindowsControls } from './WindowsControls';

interface WindowControlsOverlayProps {
	window: WindowState;
}

/**
 * Floating controls for fullSizeContent windows.
 * macOS: traffic lights top-left. Windows/Linux: buttons top-right.
 */
export function WindowControlsOverlay({ window: win }: WindowControlsOverlayProps) {
	const closeWindow = useWindowStore((s) => s.closeWindow);
	const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
	const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
	const restoreWindow = useWindowStore((s) => s.restoreWindow);
	const platform = usePlatform();
	const isMac = platform === 'macos';

	const handleClose = () => closeWindow(win.id);
	const handleMinimize = () => minimizeWindow(win.id);
	const handleMaximize = () => (win.maximized ? restoreWindow(win.id) : maximizeWindow(win.id));

	return (
		<div
			data-no-drag
			className="absolute z-20 flex items-center"
			style={{
				inset: isMac
					? 'var(--khal-controls-inset-mac, 10px auto auto 10px)'
					: 'var(--khal-controls-inset, 6px 6px auto auto)',
				gap: 'var(--khal-controls-gap, 2px)',
			}}
			onPointerDown={(e) => e.stopPropagation()}
			role="toolbar"
			aria-label="Window controls"
		>
			{isMac ? (
				<TrafficLights
					focused={win.focused}
					onClose={handleClose}
					onMinimize={handleMinimize}
					onMaximize={handleMaximize}
				/>
			) : (
				<WindowsControls
					maximized={win.maximized}
					onClose={handleClose}
					onMinimize={handleMinimize}
					onMaximize={handleMaximize}
				/>
			)}
		</div>
	);
}
