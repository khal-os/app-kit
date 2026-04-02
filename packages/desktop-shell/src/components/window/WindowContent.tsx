interface WindowContentProps {
	children: React.ReactNode;
}

export function WindowContent({ children }: WindowContentProps) {
	return (
		<div
			className="khal-window-content relative flex-1 overflow-auto"
			style={{ background: 'var(--khal-window-content-bg, var(--khal-surface-default))' }}
		>
			{children}
		</div>
	);
}
