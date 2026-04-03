/**
 * Isomorphic filename validation — no Node.js dependencies.
 * Safe to import from both client (React) and server (API routes / services).
 */

const FORBIDDEN_CHARS = /[/\\\0]/;
const TRAVERSAL_SEGMENTS = /(?:^|\/)\.\.(?:\/|$)/;
const RESERVED_NAMES = /^\.+$/;

/**
 * Validate a filename (not a path — just the basename).
 * Returns an error message string if invalid, or `null` if valid.
 */
export function validateFilename(name: string): string | null {
	const trimmed = name.trim();
	if (trimmed.length === 0) return 'Name cannot be empty';
	if (trimmed.length > 255) return 'Name is too long (max 255 characters)';
	if (FORBIDDEN_CHARS.test(trimmed)) return 'Name contains forbidden characters (/ \\ or null)';
	if (TRAVERSAL_SEGMENTS.test(trimmed)) return 'Name cannot contain path traversal (..)';
	if (RESERVED_NAMES.test(trimmed)) return 'Name cannot be only dots';
	return null;
}

/**
 * Sanitize a filename by stripping dangerous characters.
 * Throws if the result is empty after sanitization.
 */
export function sanitizeFilename(name: string): string {
	// Strip null bytes, slashes, backslashes, and path traversal sequences
	let clean = name
		.replace(/\0/g, '')
		.replace(/[/\\]/g, '')
		.replace(/\.{2,}/g, '.')
		.trim();
	// Collapse leading dots to a single dot
	clean = clean.replace(/^\.+/, '.');
	if (clean.length === 0) {
		throw new Error('Filename is empty after sanitization');
	}
	return clean;
}
