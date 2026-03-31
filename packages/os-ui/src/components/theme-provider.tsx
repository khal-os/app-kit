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

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
	return (
		<NextThemesProvider {...props}>
			<ReduceMotionSync />
			{children}
		</NextThemesProvider>
	);
}
