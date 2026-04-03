import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export { sanitizeFilename, validateFilename } from './filename-validation';

/** Max single-file upload size: 100 MB */
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

/** Max entries in a single zip download */
export const MAX_ZIP_ENTRIES = 100;

export function getFilesRoot(): string {
	return process.env.KHAL_FILES_ROOT || join(homedir(), 'khal-files');
}

/**
 * Resolve a user-provided path safely within the root directory.
 * Rejects path traversal attempts and symlink escapes.
 */
export function resolveSafePath(root: string, userPath: string): string {
	const resolved = resolve(root, userPath.replace(/^\/+/, ''));
	if (resolved !== root && !resolved.startsWith(`${root}/`)) {
		throw new Error('Path traversal detected');
	}
	// Symlink escape check: if the target exists, ensure its real path is within root
	if (existsSync(resolved)) {
		const real = realpathSync(resolved);
		if (real !== root && !real.startsWith(`${root}/`)) {
			throw new Error('Symlink escape detected');
		}
	}
	return resolved;
}

/**
 * Encode a filename for use in Content-Disposition headers (RFC 5987).
 * Uses percent-encoding for non-ASCII and special characters.
 */
export function escapeContentDisposition(filename: string): string {
	// ASCII fallback: replace non-ASCII with underscores
	const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
	// RFC 5987 encoded value
	const encoded = encodeURIComponent(filename).replace(
		/['()]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
	);
	return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
