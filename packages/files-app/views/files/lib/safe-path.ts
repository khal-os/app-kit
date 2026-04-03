import * as path from 'node:path';

const DEFAULT_FILES_ROOT = path.join(process.env.HOME || '/tmp', 'khal-files');

/** Get the root directory for the files service. */
export function getFilesRoot(): string {
	return process.env.KHAL_FILES_ROOT || DEFAULT_FILES_ROOT;
}

/**
 * Resolve a user-provided path within the root directory, preventing
 * path traversal attacks. Throws if the resolved path escapes root.
 */
export function resolveSafePath(root: string, userPath: string): string {
	const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
	const resolved = path.resolve(root, normalized);

	if (!resolved.startsWith(root)) {
		throw new Error(`Path traversal detected: ${userPath}`);
	}

	return resolved;
}

/**
 * Validate a filename. Returns null if valid, or an error message string.
 */
export function validateFilename(name: string): string | null {
	if (!name || name.trim().length === 0) {
		return 'Filename cannot be empty';
	}
	if (name.includes('/') || name.includes('\\')) {
		return 'Filename cannot contain path separators';
	}
	if (name === '.' || name === '..') {
		return 'Invalid filename';
	}
	if (name.length > 255) {
		return 'Filename too long (max 255 characters)';
	}
	// Block null bytes
	if (name.includes('\0')) {
		return 'Filename contains invalid characters';
	}
	return null;
}
