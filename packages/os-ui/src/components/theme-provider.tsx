'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect } from 'react';
import { useThemeStore } from '../stores/theme-store';

function ReduceMotionSync() {
	const reduceMotion = useThemeStore((s) => s.reduceMotion);

	useEffect(() => {
		document.documentElement.setAttribute('data-reduce-motion', String(reduceMotion));
	}, [reduceMotion]);

	return null;
}

function GlassSync() {
	const glassEnabled = useThemeStore((s) => s.glassEnabled);

	useEffect(() => {
		const el = document.documentElement;
		if (glassEnabled) {
			el.setAttribute('data-glass', '');
			el.style.setProperty('--khal-glass-enabled', '1');
		} else {
			el.removeAttribute('data-glass');
			el.style.setProperty('--khal-glass-enabled', '0');
		}
	}, [glassEnabled]);

	return null;
}

function GpuTerminalsSync() {
	const gpuTerminals = useThemeStore((s) => s.gpuTerminals);

	useEffect(() => {
		// Sync to the localStorage key the terminal reads on mount
		if (gpuTerminals) {
			localStorage.setItem('khal-gpu-terminals', 'true');
		} else {
			localStorage.removeItem('khal-gpu-terminals');
		}
	}, [gpuTerminals]);

	return null;
}

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
	return (
		<NextThemesProvider {...props}>
			<ReduceMotionSync />
			<GlassSync />
			<GpuTerminalsSync />
			{children}
		</NextThemesProvider>
	);
}
