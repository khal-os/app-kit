import { Maximize2, Minimize2, Minus, X } from 'lucide-react';

interface WindowsControlsProps {
	maximized: boolean;
	onClose: () => void;
	onMinimize: () => void;
	onMaximize: () => void;
}

const btnBase = 'flex items-center justify-center transition-colors' as const;

/** Windows 11-style minimize/maximize/close buttons, positioned on the right. */
export function WindowsControls({ maximized, onClose, onMinimize, onMaximize }: WindowsControlsProps) {
	return (
		<div
			className="flex items-center"
			style={{ marginRight: 'calc(var(--khal-frame-padding-x, 12px) * -1)' }}
			onPointerDown={(e) => e.stopPropagation()}
			role="toolbar"
			aria-label="Window controls"
		>
			<button
				type="button"
				className={btnBase}
				style={{
					width: 46,
					height: 'var(--khal-frame-height, 40px)',
					color: 'var(--khal-text-muted)',
				}}
				onMouseEnter={(e) => {
					(e.currentTarget as HTMLElement).style.background = 'var(--khal-accent-subtle)';
				}}
				onMouseLeave={(e) => {
					(e.currentTarget as HTMLElement).style.background = 'transparent';
				}}
				onClick={onMinimize}
				aria-label="Minimize window"
			>
				<Minus size={16} />
			</button>
			<button
				type="button"
				className={btnBase}
				style={{
					width: 46,
					height: 'var(--khal-frame-height, 40px)',
					color: 'var(--khal-text-muted)',
				}}
				onMouseEnter={(e) => {
					(e.currentTarget as HTMLElement).style.background = 'var(--khal-accent-subtle)';
				}}
				onMouseLeave={(e) => {
					(e.currentTarget as HTMLElement).style.background = 'transparent';
				}}
				onClick={onMaximize}
				aria-label={maximized ? 'Restore window' : 'Maximize window'}
			>
				{maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
			</button>
			<button
				type="button"
				className={btnBase}
				style={{
					width: 46,
					height: 'var(--khal-frame-height, 40px)',
					color: 'var(--khal-text-muted)',
					borderRadius: '0 var(--khal-window-radius, 12px) 0 0',
				}}
				onMouseEnter={(e) => {
					const el = e.currentTarget as HTMLElement;
					el.style.background = '#c42b1c';
					el.style.color = '#ffffff';
				}}
				onMouseLeave={(e) => {
					const el = e.currentTarget as HTMLElement;
					el.style.background = 'transparent';
					el.style.color = 'var(--khal-text-muted)';
				}}
				onClick={onClose}
				aria-label="Close window"
			>
				<X size={16} />
			</button>
		</div>
	);
}
