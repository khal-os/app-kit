import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'app/index': 'src/app/index.ts',
		'app/roles': 'src/app/roles.ts',
		'app/subjects': 'src/app/subjects.ts',
		'runtime/index': 'src/runtime/index.ts',
	},
	format: ['esm', 'cjs'],
	tsconfig: 'tsconfig.build.json',
	dts: true,
	sourcemap: true,
	clean: true,
	outDir: 'dist',
	external: ['react', '@khal-os/types'],
});
