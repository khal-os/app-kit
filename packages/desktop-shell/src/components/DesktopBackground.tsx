import { KhalLogo, MESH_GRADIENT_PALETTE } from '@khal-os/ui';
import { MeshGradient } from '@paper-design/shaders-react';
import { useEffect, useState } from 'react';

const PALETTE = [...MESH_GRADIENT_PALETTE];

/**
 * Desktop background -- identical to LP hero (khal-landing/components/hero.tsx).
 * LP stack: #0A0A0A base -> hero.webp (overlay) -> MeshGradient (screen, bottom 700px, masked).
 *
 * NOTE: The original used Next.js `Image` component. In the desktop-shell package,
 * we use a plain `<img>` tag to avoid Next.js dependency.
 */
export function DesktopBackground() {
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		const handler = () => setVisible(document.visibilityState === 'visible');
		document.addEventListener('visibilitychange', handler);
		return () => document.removeEventListener('visibilitychange', handler);
	}, []);

	return (
		<div className="fixed inset-0 z-0 pointer-events-none overflow-clip" style={{ background: '#0A0A0A' }}>
			{/* Background photo layer */}
			<div className="absolute inset-0 z-0" style={{ mixBlendMode: 'overlay' }}>
				<img src="/images/hero.webp" alt="" className="w-full h-full object-cover opacity-[0.9]" />
			</div>

			{/* MeshGradient -- same params as LP hero.tsx, full-screen for desktop */}
			<div
				className="absolute inset-0 z-[1]"
				style={{
					mixBlendMode: 'screen',
				}}
			>
				{visible && (
					<MeshGradient
						colors={PALETTE}
						speed={0.15}
						distortion={0.6}
						swirl={0.4}
						fit="cover"
						style={{ width: '100%', height: '100%' }}
					/>
				)}
			</div>

			{/* KHAL wordmark watermark -- barely solid */}
			<div className="absolute inset-0 z-[2] flex items-center justify-center">
				<KhalLogo size={80} variant="light" className="opacity-[0.4]" />
			</div>
		</div>
	);
}
