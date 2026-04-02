import { useEffect, useRef } from 'react';

interface TabContextMenuProps {
	x: number;
	y: number;
	onRename: () => void;
	onPopOut: () => void;
	onClose: () => void;
	onDismiss: () => void;
	/** Whether the tab can be popped out / closed (false when it's the only tab). */
	canRemove: boolean;
}

export function TabContextMenu({ x, y, onRename, onPopOut, onClose, onDismiss, canRemove }: TabContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);

	/* Dismiss on click outside */
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onDismiss();
			}
		};
		/* Use capture + timeout so the menu's own click handler fires first */
		const id = requestAnimationFrame(() => {
			document.addEventListener('mousedown', handler, { capture: true });
		});
		return () => {
			cancelAnimationFrame(id);
			document.removeEventListener('mousedown', handler, { capture: true });
		};
	}, [onDismiss]);

	/* Dismiss on Escape */
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onDismiss();
			}
		};
		window.addEventListener('keydown', handler, { capture: true });
		return () => window.removeEventListener('keydown', handler, { capture: true });
	}, [onDismiss]);

	return (
		<div
			ref={menuRef}
			className="fixed rounded-lg shadow-xl"
			style={{
				left: x,
				top: y,
				zIndex: 10001,
				minWidth: 160,
				padding: '4px 0',
				background: 'var(--khal-surface, rgba(30,30,40,0.92))',
				backdropFilter: 'blur(40px) saturate(1.8)',
				WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
				border: '1px solid var(--khal-taskbar-border, rgba(255,255,255,0.08))',
			}}
		>
			<ContextMenuItem label="Rename" onClick={onRename} />

			{/* Separator */}
			<div
				style={{
					height: 1,
					margin: '4px 8px',
					background: 'rgba(255,255,255,0.08)',
				}}
			/>

			<ContextMenuItem label="Open in window" onClick={onPopOut} disabled={!canRemove} />
			<ContextMenuItem label="Close" onClick={onClose} disabled={!canRemove} />
		</div>
	);
}

function ContextMenuItem({
	label,
	onClick,
	disabled = false,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={(e) => {
				e.stopPropagation();
				if (!disabled) onClick();
			}}
			className="block w-full text-left transition-colors"
			style={{
				padding: '8px 16px',
				fontSize: 13,
				lineHeight: '18px',
				color: disabled ? 'var(--khal-text-secondary, rgba(255,255,255,0.35))' : 'var(--khal-text-primary, #fff)',
				background: 'transparent',
				border: 'none',
				cursor: disabled ? 'default' : 'default',
				opacity: disabled ? 0.5 : 1,
			}}
			onMouseEnter={(e) => {
				if (!disabled) {
					e.currentTarget.style.background = 'oklch(0.74 0.11 65 / 0.12)';
				}
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = 'transparent';
			}}
		>
			{label}
		</button>
	);
}
