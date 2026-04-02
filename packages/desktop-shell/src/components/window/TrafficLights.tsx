import { useState } from 'react';

interface TrafficLightsProps {
	focused: boolean;
	onClose: () => void;
	onMinimize: () => void;
	onMaximize: () => void;
}

const DOT_SIZE = 12;

/** macOS-style close/minimize/maximize colored dots, positioned on the left. */
export function TrafficLights({ focused, onClose, onMinimize, onMaximize }: TrafficLightsProps) {
	const [hovered, setHovered] = useState(false);

	const unfocusedBg = 'var(--khal-border-default)';
	const showIcons = hovered && focused;

	return (
		<div
			className="flex items-center"
			style={{ gap: 8 }}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onPointerDown={(e) => e.stopPropagation()}
			role="toolbar"
			aria-label="Window controls"
		>
			{/* Close -- red */}
			<button
				type="button"
				className="flex items-center justify-center rounded-full transition-colors"
				style={{
					width: DOT_SIZE,
					height: DOT_SIZE,
					background: focused ? '#FF5F57' : unfocusedBg,
				}}
				onClick={onClose}
				aria-label="Close window"
			>
				{showIcons && (
					<svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true">
						<path
							d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5"
							stroke="rgba(0,0,0,0.5)"
							strokeWidth="1.25"
							strokeLinecap="round"
						/>
					</svg>
				)}
			</button>

			{/* Minimize -- yellow */}
			<button
				type="button"
				className="flex items-center justify-center rounded-full transition-colors"
				style={{
					width: DOT_SIZE,
					height: DOT_SIZE,
					background: focused ? '#FEBC2E' : unfocusedBg,
				}}
				onClick={onMinimize}
				aria-label="Minimize window"
			>
				{showIcons && (
					<svg width="6" height="2" viewBox="0 0 6 2" aria-hidden="true">
						<path d="M0.5 1H5.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.25" strokeLinecap="round" />
					</svg>
				)}
			</button>

			{/* Maximize / fullscreen -- green */}
			<button
				type="button"
				className="flex items-center justify-center rounded-full transition-colors"
				style={{
					width: DOT_SIZE,
					height: DOT_SIZE,
					background: focused ? '#28C840' : unfocusedBg,
				}}
				onClick={onMaximize}
				aria-label="Maximize window"
			>
				{showIcons && (
					<svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true">
						{/* Diagonal expand arrows */}
						<path
							d="M5.25 0.75H3.5M5.25 0.75V2.5M0.75 5.25H2.5M0.75 5.25V3.5"
							stroke="rgba(0,0,0,0.5)"
							strokeWidth="1.25"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</button>
		</div>
	);
}
