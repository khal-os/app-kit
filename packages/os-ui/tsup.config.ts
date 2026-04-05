import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	tsconfig: 'tsconfig.build.json',
	dts: true,
	sourcemap: true,
	clean: true,
	outDir: 'dist',
	external: ['react', 'next-themes', 'zustand', '@khal-os/sdk', '@khal-os/sdk/app'],
});
