interface KhalLogoProps {
	size?: number;
	variant?: 'light' | 'dark';
	className?: string;
}

export function KhalLogo({ size = 20, variant = 'light', className }: KhalLogoProps) {
	const showFull = size >= 20;
	const color = variant === 'light' ? '#FFFFFF' : '#0A0A0A';

	const fontSize = showFull ? size * 0.72 : size * 0.85;
	const tracking = -0.03;

	return (
		<span
			className={className}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				fontSize,
				fontWeight: 700,
				letterSpacing: `${tracking}em`,
				lineHeight: 1,
				whiteSpace: 'nowrap',
				color,
			}}
			aria-label="khal"
		>
			{showFull ? 'khal' : 'k'}
		</span>
	);
}
