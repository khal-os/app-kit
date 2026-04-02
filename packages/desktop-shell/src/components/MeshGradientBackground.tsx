import { MESH_GRADIENT_PALETTE, MeshGradient } from '@khal-os/ui';
import { useEffect, useState } from 'react';

const PALETTE = [...MESH_GRADIENT_PALETTE];

function StaticFallback() {
	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				background: `linear-gradient(135deg, ${PALETTE[0]} 0%, ${PALETTE[3]} 50%, ${PALETTE[7]} 100%)`,
			}}
		/>
	);
}

/**
 * Mesh gradient background -- LP-matched shader params.
 *
 * LP hero uses: speed=0.8, distortion=0.6, swirl=0.4, fit=cover
 * OS desktop uses speed=0.3 for a calmer persistent background,
 * but keeps the same color palette and composition.
 */
export function MeshGradientBackground() {
	const [tabVisible, setTabVisible] = useState(true);

	useEffect(() => {
		const onVisibilityChange = () => {
			setTabVisible(document.visibilityState === 'visible');
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => document.removeEventListener('visibilitychange', onVisibilityChange);
	}, []);

	if (!tabVisible) {
		return <StaticFallback />;
	}

	return <MeshGradient colors={PALETTE} speed={0.3} style={{ width: '100%', height: '100%' }} />;
}
