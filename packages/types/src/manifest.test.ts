import { describe, expect, test } from 'bun:test';
import { ZodError } from 'zod';
import { validateManifest } from './manifest';

const validManifest = {
	id: 'terminal',
	name: 'Terminal',
	version: '1.0.0',
	icon: './assets/icon.svg',
	description: 'A terminal emulator for KhalOS',
	author: 'KhalOS Core Team',
	permissions: ['pty:spawn', 'files:read'] as const,
};

describe('validateManifest', () => {
	test('valid manifest passes validation', () => {
		const result = validateManifest(validManifest);
		expect(result.id).toBe('terminal');
		expect(result.name).toBe('Terminal');
		expect(result.version).toBe('1.0.0');
		expect(result.permissions).toEqual(['pty:spawn', 'files:read']);
	});

	test('missing required field (id) throws ZodError', () => {
		const { id: _, ...noId } = validManifest;
		expect(() => validateManifest(noId)).toThrow(ZodError);
	});

	test('unknown field is rejected by strict mode', () => {
		const withExtra = { ...validManifest, unknownField: 'bad' };
		expect(() => validateManifest(withExtra)).toThrow(ZodError);
	});

	test('valid manifest with optional fields round-trips', () => {
		const full = {
			...validManifest,
			$schema: 'https://example.com/schema.json',
			services: [
				{
					name: 'backend',
					command: 'bun run start',
					runtime: 'bun' as const,
					ports: [3000],
					health: { type: 'tcp' as const, target: 3000, interval: 30000 },
				},
			],
			windows: [
				{ id: 'main', title: 'Terminal', width: 1024, height: 768, resizable: true },
			],
			frontend: {
				package: '@khal-os/pack-terminal',
			},
			backend: {
				image: 'ghcr.io/khal-os/pack-terminal-service',
				helmChart: 'oci://ghcr.io/khal-os/charts/pack-terminal',
				env: { NODE_ENV: 'production' },
				ports: [3000],
			},
		};

		const result = validateManifest(full);
		expect(result.services).toHaveLength(1);
		expect(result.services![0].name).toBe('backend');
		expect(result.windows).toHaveLength(1);
		expect(result.frontend!.package).toBe('@khal-os/pack-terminal');
		expect(result.frontend!.entry).toBe('default'); // default value applied
		expect(result.backend!.image).toBe('ghcr.io/khal-os/pack-terminal-service');
	});

	test('invalid permission value is rejected', () => {
		const badPerm = { ...validManifest, permissions: ['invalid:perm'] };
		expect(() => validateManifest(badPerm)).toThrow(ZodError);
	});

	test('empty permissions array is valid', () => {
		const noPerm = { ...validManifest, permissions: [] };
		const result = validateManifest(noPerm);
		expect(result.permissions).toEqual([]);
	});
});
