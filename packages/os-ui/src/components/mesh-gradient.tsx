'use client';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

const MeshGradientShader = lazy(() => import('@paper-design/shaders-react').then((m) => ({ default: m.MeshGradient })));

interface MeshGradientProps {
	/** Array of CSS color strings (typically 4-8) */
	colors: string[];
	/** Animation speed multiplier (default 0.02) */
	speed?: number;
	className?: string;
	style?: React.CSSProperties;
}

function StaticFallback({ colors }: { colors: string[] }) {
	const bg =
		colors.length >= 2
			? `linear-gradient(135deg, ${colors[0]} 0%, ${colors[Math.floor(colors.length / 2)]} 50%, ${colors[colors.length - 1]} 100%)`
			: (colors[0] ?? '#0A0A0A');

	return <div style={{ width: '100%', height: '100%', background: bg }} />;
}

function MeshGradientInner({ colors, speed = 0.02, className, style }: MeshGradientProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	const reducedMotion = useReducedMotion();

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
			rootMargin: '100px',
		});

		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} className={className} style={{ position: 'absolute', inset: 0, ...style }}>
			{visible && !reducedMotion ? (
				<Suspense fallback={<StaticFallback colors={colors} />}>
					<MeshGradientShader colors={colors} speed={speed} style={{ width: '100%', height: '100%' }} />
				</Suspense>
			) : (
				<StaticFallback colors={colors} />
			)}
		</div>
	);
}

export type { MeshGradientProps };
export { MeshGradientInner as MeshGradient };
