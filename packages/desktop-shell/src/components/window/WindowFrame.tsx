import { usePlatform } from '../../lib/platform';
import { useWindowStore } from '../../stores/window-store';
import type { WindowState } from '../../types/window';
import { TrafficLights } from './TrafficLights';
import { WindowsControls } from './WindowsControls';

interface WindowFrameProps {
	window: WindowState;
	onPointerDownTitleBar: (e: React.PointerEvent) => void;
	onDoubleClickTitleBar?: () => void;
}

export function WindowFrame({ window: win, onPointerDownTitleBar, onDoubleClickTitleBar }: WindowFrameProps) {
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
		<header
			className="khal-window-frame relative flex shrink-0 items-center justify-between select-none"
			style={{
				height: 'var(--khal-frame-height, 40px)',
				paddingLeft: 'var(--khal-frame-padding-x, 12px)',
				paddingRight: 'var(--khal-frame-padding-x, 12px)',
				background: win.focused
					? 'var(--khal-window-frame-bg-focused, var(--khal-window-title-bg-focused))'
					: 'var(--khal-window-frame-bg, var(--khal-window-title-bg))',
				borderBottom: `var(--khal-window-frame-border-bottom, 1px solid ${win.focused ? 'var(--khal-border-strong)' : 'var(--khal-border-default)'})`,
				backdropFilter: 'blur(40px) saturate(1.8)',
				WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
			}}
			onPointerDown={onPointerDownTitleBar}
			onDoubleClick={onDoubleClickTitleBar}
		>
			{/* Left zone -- traffic lights on macOS */}
			<div className="relative z-10 flex shrink-0 items-center">
				{isMac && (
					<TrafficLights
						focused={win.focused}
						onClose={handleClose}
						onMinimize={handleMinimize}
						onMaximize={handleMaximize}
					/>
				)}
			</div>

			{/* Centered title */}
			<h2
				className="pointer-events-none absolute inset-x-0 truncate text-center font-medium"
				style={{
					fontSize: 'var(--khal-frame-font-size, 13px)',
					color: win.focused ? 'var(--khal-text-secondary)' : 'var(--khal-text-muted)',
					lineHeight: 'var(--khal-frame-height, 40px)',
					paddingLeft: 60,
					paddingRight: 60,
				}}
			>
				{win.title}
			</h2>

			{/* Right zone -- Windows controls on non-Mac */}
			<div className="relative z-10 flex shrink-0 items-center" style={{ gap: 'var(--khal-controls-gap, 2px)' }}>
				{!isMac && (
					<WindowsControls
						maximized={win.maximized}
						onClose={handleClose}
						onMinimize={handleMinimize}
						onMaximize={handleMaximize}
					/>
				)}
			</div>
		</header>
	);
}
