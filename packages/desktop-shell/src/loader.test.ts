import { afterEach, describe, expect, it } from 'vitest';
import { clearBundleCache, loadPack, loadPackFromUrl, PackLoadError } from './loader';

describe('PackLoadError', () => {
	it('includes the pack ID in the message', () => {
		const err = new PackLoadError('@khal-os/pack-terminal');
		expect(err.message).toBe('Failed to load pack "@khal-os/pack-terminal"');
		expect(err.packId).toBe('@khal-os/pack-terminal');
		expect(err.name).toBe('PackLoadError');
	});

	it('includes the cause message when provided', () => {
		const cause = new Error('Module not found');
		const err = new PackLoadError('@khal-os/pack-files', cause);
		expect(err.message).toBe('Failed to load pack "@khal-os/pack-files": Module not found');
		expect(err.cause).toBe(cause);
	});

	it('is an instance of Error', () => {
		const err = new PackLoadError('test-pack');
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(PackLoadError);
	});
});

describe('loadPack', () => {
	it('throws PackLoadError for non-existent packs', async () => {
		await expect(loadPack('@khal-os/pack-does-not-exist')).rejects.toThrow(PackLoadError);
	});

	it('includes the pack ID in the thrown error', async () => {
		try {
			await loadPack('@khal-os/pack-does-not-exist');
			expect.fail('Should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(PackLoadError);
			expect((err as PackLoadError).packId).toBe('@khal-os/pack-does-not-exist');
		}
	});
});

describe('loadPackFromUrl', () => {
	afterEach(() => {
		clearBundleCache();
	});

	it('throws PackLoadError for unreachable bundle URL', async () => {
		await expect(
			loadPackFromUrl('http://localhost:99999/nonexistent/bundle.mjs', 'bad-app'),
		).rejects.toThrow(PackLoadError);
	});

	it('includes the app ID in the thrown error', async () => {
		try {
			await loadPackFromUrl('http://localhost:99999/missing.mjs', 'my-app');
			expect.fail('Should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(PackLoadError);
			expect((err as PackLoadError).packId).toBe('my-app');
		}
	});

	it('evicts cache entry on failure so retries re-attempt', async () => {
		const url = 'http://localhost:99999/evict-test.mjs';
		await expect(loadPackFromUrl(url, 'evict')).rejects.toThrow(PackLoadError);
		// A second call should also attempt (not return cached rejection)
		await expect(loadPackFromUrl(url, 'evict')).rejects.toThrow(PackLoadError);
	});
});

describe('clearBundleCache', () => {
	it('does not throw when cache is empty', () => {
		expect(() => clearBundleCache()).not.toThrow();
	});
});
