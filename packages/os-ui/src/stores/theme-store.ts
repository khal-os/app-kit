import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
	reduceMotion: boolean;
	setReduceMotion: (value: boolean) => void;
}

export const useThemeStore = create<ThemeStore>()(
	persist(
		(set) => ({
			mode: 'dark' as ThemeMode,
			setMode: (mode) => set({ mode }),
			reduceMotion: false,
			setReduceMotion: (reduceMotion) => set({ reduceMotion }),
		}),
		{
			name: 'khal-theme',
		}
	)
);
