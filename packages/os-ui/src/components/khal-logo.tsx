interface KhalLogoProps {
	size?: number;
	variant?: 'light' | 'dark';
	className?: string;
}

/**
 * KhalLogo — SVG wordmark for large sizes (>=20), single "K" letterform for small sizes.
 * Uses currentColor so color is inherited from parent.
 */
export function KhalLogo({ size = 20, variant = 'light', className }: KhalLogoProps) {
	const color = variant === 'light' ? '#FFFFFF' : '#0A0A0A';
	const showFull = size >= 20;

	if (!showFull) {
		// Small sizes: render just the K letterform from the SVG
		return (
			<svg
				viewBox="0 0 156 155"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				height={size}
				className={className}
				aria-label="K"
				style={{ color }}
			>
				<path
					d="M0 0H27.4425V65.9519H71.7054L122.829 0H155.362L95.3869 76.1317L164.657 154.92H128.805L72.5913 92.2878H27.4425V154.92H0V0Z"
					fill="currentColor"
				/>
			</svg>
		);
	}

	// Full wordmark SVG
	return (
		<svg
			viewBox="0 0 756 155"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			width={size * (756 / 155)}
			height={size}
			className={className}
			aria-label="khal"
			style={{ color }}
		>
			<g clipPath="url(#khal-logo-clip)">
				<path
					d="M616.81 0H644.252V128.584H765.533V154.92H638.499C635.4 154.92 632.524 154.33 629.867 153.149C627.211 151.969 624.924 150.42 623.007 148.502C621.088 146.584 619.539 144.371 618.359 141.863C617.326 139.206 616.81 136.403 616.81 133.453V0Z"
					fill="currentColor"
				/>
				<path
					d="M443.058 21.2467C445.123 14.4594 448.295 9.22105 452.573 5.53287C456.853 1.8447 462.533 0 469.616 0H519.632C527.009 0 532.911 1.91744 537.337 5.75467C541.763 9.44285 545.009 14.6072 547.076 21.2467L589.125 154.92H560.133L546.411 110.657H461.87L468.73 84.3212H538.665L521.181 26.3359H468.951L430 154.92H400.786L443.058 21.2467Z"
					fill="currentColor"
				/>
				<path
					d="M190.123 0H217.565V62.6322H344.6V0H372.043V154.92H344.6V88.9681H217.565V154.92H190.123V0Z"
					fill="currentColor"
				/>
				<path
					d="M0 0H27.4425V65.9519H71.7054L122.829 0H155.362L95.3869 76.1317L164.657 154.92H128.805L72.5913 92.2878H27.4425V154.92H0V0Z"
					fill="currentColor"
				/>
			</g>
			<defs>
				<clipPath id="khal-logo-clip">
					<rect width="756" height="155" fill="white" />
				</clipPath>
			</defs>
		</svg>
	);
}
