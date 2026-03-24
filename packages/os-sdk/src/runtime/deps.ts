/**
 * Binary dependency downloader.
 *
 * Downloads and caches binaries (NATS server, Bun) into ~/.khal-os/bin/.
 * Uses native Node.js modules only — no external dependencies.
 */

import { chmodSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { get as httpGet, type IncomingMessage } from 'node:http';
import { get as httpsGet } from 'node:https';
import { homedir, arch as osArch, platform as osPlatform } from 'node:os';
import { join } from 'node:path';
import type { RuntimeEvent } from './types';

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

type Platform = 'linux' | 'darwin' | 'windows';
type Arch = 'x64' | 'arm64';

function detectPlatform(): Platform {
	const p = osPlatform();
	if (p === 'win32') return 'windows';
	if (p === 'darwin') return 'darwin';
	return 'linux';
}

function detectArch(): Arch {
	const a = osArch();
	if (a === 'arm64' || a === 'aarch64') return 'arm64';
	return 'x64';
}

// ---------------------------------------------------------------------------
// Download URL builders
// ---------------------------------------------------------------------------

/**
 * Return the download URL for a NATS server release.
 * @see https://github.com/nats-io/nats-server/releases
 */
export function getNatsUrl(version: string, platform: Platform, arch: Arch): string {
	const os = platform === 'windows' ? 'windows' : platform;
	const a = arch === 'arm64' ? 'arm64' : 'amd64';
	const ext = platform === 'windows' ? 'zip' : 'tar.gz';
	return `https://github.com/nats-io/nats-server/releases/download/v${version}/nats-server-v${version}-${os}-${a}.${ext}`;
}

/**
 * Return the download URL for a Bun release.
 * @see https://github.com/oven-sh/bun/releases
 */
export function getBunUrl(version: string, platform: Platform, arch: Arch): string {
	const os = platform === 'windows' ? 'windows' : platform;
	const a = arch === 'arm64' ? 'aarch64' : 'x64';
	const profile = 'baseline';
	const ext = platform === 'windows' ? 'zip' : 'zip';
	return `https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-${os}-${a}-${profile}.${ext}`;
}

// ---------------------------------------------------------------------------
// Download + extract
// ---------------------------------------------------------------------------

/**
 * Follow redirects (GitHub releases use 302).
 */
function followRedirects(url: string, maxRedirects = 5): Promise<IncomingMessage> {
	return new Promise((resolve, reject) => {
		if (maxRedirects <= 0) {
			reject(new Error('Too many redirects'));
			return;
		}

		const get = url.startsWith('https') ? httpsGet : httpGet;
		get(url, (res) => {
			if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				followRedirects(res.headers.location, maxRedirects - 1).then(resolve, reject);
				return;
			}
			if (res.statusCode && res.statusCode >= 400) {
				reject(new Error(`HTTP ${res.statusCode} for ${url}`));
				return;
			}
			resolve(res);
		}).on('error', reject);
	});
}

/**
 * Download a file to disk with redirect support.
 */
function downloadFile(url: string, dest: string): Promise<void> {
	return new Promise((resolve, reject) => {
		followRedirects(url)
			.then((res) => {
				const file = createWriteStream(dest);
				res.pipe(file);
				file.on('finish', () => {
					file.close();
					resolve();
				});
				file.on('error', (err) => {
					rmSync(dest, { force: true });
					reject(err);
				});
			})
			.catch(reject);
	});
}

/**
 * Extract a .tar.gz archive to a directory.
 * Returns the path of the first extracted file matching `binaryName`.
 */
async function extractTarGz(archivePath: string, destDir: string, binaryName: string): Promise<string> {
	// Use tar command — simpler and more reliable than pure JS tar parsing.
	const { execSync } = await import('node:child_process');
	execSync(`tar xzf "${archivePath}" -C "${destDir}"`, { stdio: 'pipe' });

	// Find the binary recursively
	const found = execSync(`find "${destDir}" -name "${binaryName}" -type f`, { encoding: 'utf8' }).trim();
	const lines = found.split('\n').filter(Boolean);
	if (lines.length === 0) {
		throw new Error(`Binary '${binaryName}' not found in archive`);
	}
	return lines[0];
}

/**
 * Extract a .zip archive to a directory.
 * Returns the path of the first extracted file matching `binaryName`.
 */
async function extractZip(archivePath: string, destDir: string, binaryName: string): Promise<string> {
	const { execSync } = await import('node:child_process');
	execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'pipe' });

	const found = execSync(`find "${destDir}" -name "${binaryName}" -type f`, { encoding: 'utf8' }).trim();
	const lines = found.split('\n').filter(Boolean);
	if (lines.length === 0) {
		throw new Error(`Binary '${binaryName}' not found in archive`);
	}
	return lines[0];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Default binary cache directory.
 */
export function defaultBinDir(): string {
	return join(homedir(), '.khal-os', 'bin');
}

/**
 * Ensure a binary is downloaded and cached. Returns the absolute path to the binary.
 *
 * @param name       - Binary name (e.g. 'nats-server', 'bun')
 * @param version    - Version string (e.g. '2.10.24')
 * @param binDir     - Cache directory (default: ~/.khal-os/bin/)
 * @param downloadUrl - URL to download the archive from
 * @param emit       - Optional event emitter for progress
 */
export async function ensureBinary(
	name: string,
	version: string,
	binDir: string,
	downloadUrl: string,
	emit?: (event: RuntimeEvent) => void
): Promise<string> {
	mkdirSync(binDir, { recursive: true });

	const binaryPath = join(binDir, `${name}-${version}`);

	// Already cached — return immediately.
	if (existsSync(binaryPath)) {
		emit?.({ type: 'dep:ready', name, path: binaryPath });
		return binaryPath;
	}

	emit?.({ type: 'dep:downloading', name, url: downloadUrl });

	// Download to a temp file.
	const ext = downloadUrl.endsWith('.tar.gz') ? '.tar.gz' : '.zip';
	const tmpArchive = join(binDir, `${name}-${version}-download${ext}`);
	const tmpExtract = join(binDir, `${name}-${version}-extract`);

	try {
		mkdirSync(tmpExtract, { recursive: true });
		await downloadFile(downloadUrl, tmpArchive);

		// Extract
		let extractedPath: string;
		if (ext === '.tar.gz') {
			extractedPath = await extractTarGz(tmpArchive, tmpExtract, name === 'bun' ? 'bun' : 'nats-server');
		} else {
			extractedPath = await extractZip(tmpArchive, tmpExtract, name === 'bun' ? 'bun' : 'nats-server');
		}

		// Move to final location and make executable.
		renameSync(extractedPath, binaryPath);
		chmodSync(binaryPath, 0o755);

		emit?.({ type: 'dep:ready', name, path: binaryPath });
		return binaryPath;
	} finally {
		// Clean up temp files.
		rmSync(tmpArchive, { force: true });
		rmSync(tmpExtract, { recursive: true, force: true });
	}
}

/**
 * Check if a binary is already cached (no download).
 */
export function isBinaryCached(name: string, version: string, binDir: string): boolean {
	return existsSync(join(binDir, `${name}-${version}`));
}

export { detectPlatform, detectArch, type Platform, type Arch };
