import type { AppEnvVar } from '@khal-os/types';

/**
 * Parse a `.env.example` file into structured AppEnvVar declarations.
 *
 * Format per line: `KEY=default # description`
 * - Lines starting with `#` (without `=`) are treated as comments/section headers
 * - Empty lines are skipped
 * - Type is inferred from key name patterns and default value
 *
 * @param content - Raw text content of a .env.example file
 * @returns Array of parsed environment variable declarations
 */
export function parseEnvExample(content: string): AppEnvVar[] {
	const vars: AppEnvVar[] = [];
	const lines = content.split('\n');

	for (const rawLine of lines) {
		const line = rawLine.trim();

		// Skip empty lines and pure comment lines (no = sign)
		if (line === '' || (line.startsWith('#') && !line.includes('='))) {
			continue;
		}

		// Strip leading # if it's a commented-out variable (e.g., "# KEY=value")
		const uncommented = line.startsWith('#') ? line.slice(1).trim() : line;

		// Parse KEY=value # description
		const eqIndex = uncommented.indexOf('=');
		if (eqIndex === -1) continue;

		const key = uncommented.slice(0, eqIndex).trim();
		if (!key || !/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;

		const rest = uncommented.slice(eqIndex + 1);

		// Split value and description at first `#`
		let defaultValue: string;
		let description: string;

		const commentIndex = rest.indexOf('#');
		if (commentIndex !== -1) {
			defaultValue = rest.slice(0, commentIndex).trim();
			description = rest.slice(commentIndex + 1).trim();
		} else {
			defaultValue = rest.trim();
			description = '';
		}

		// Strip surrounding quotes from default value
		if (
			(defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
			(defaultValue.startsWith("'") && defaultValue.endsWith("'"))
		) {
			defaultValue = defaultValue.slice(1, -1);
		}

		// Infer type from key name and default value
		const type = inferType(key, defaultValue);

		// Determine if required (no default = required, commented out = optional)
		const required = !line.startsWith('#') && defaultValue === '';

		// Determine visibility (secrets go to vault)
		const visibility = type === 'secret' ? 'vault' : 'config';

		const envVar: AppEnvVar = {
			key,
			description: description || `Environment variable ${key}`,
			required,
			type,
			visibility,
		};

		// Only include default if non-empty and not a placeholder
		if (defaultValue && !isPlaceholder(defaultValue)) {
			envVar.default = defaultValue;
		}

		vars.push(envVar);
	}

	return vars;
}

/** Infer the type of an env var from its key name and default value. */
function inferType(key: string, defaultValue: string): AppEnvVar['type'] {
	const upperKey = key.toUpperCase();

	// Secret patterns
	if (
		upperKey.includes('_SECRET') ||
		upperKey.includes('_KEY') ||
		upperKey.includes('_TOKEN') ||
		upperKey.includes('_PASSWORD') ||
		upperKey.includes('_CREDENTIAL') ||
		upperKey.includes('API_KEY') ||
		upperKey.endsWith('_PASS')
	) {
		return 'secret';
	}

	// URL patterns
	if (
		upperKey.includes('_URL') ||
		upperKey.includes('_URI') ||
		upperKey.includes('_ENDPOINT') ||
		upperKey.includes('_HOST') ||
		defaultValue.startsWith('http://') ||
		defaultValue.startsWith('https://') ||
		defaultValue.startsWith('postgres://') ||
		defaultValue.startsWith('nats://')
	) {
		return 'url';
	}

	// Boolean patterns
	if (
		upperKey.startsWith('ENABLE_') ||
		upperKey.startsWith('DISABLE_') ||
		upperKey.startsWith('USE_') ||
		upperKey.startsWith('IS_') ||
		upperKey.startsWith('HAS_') ||
		defaultValue === 'true' ||
		defaultValue === 'false'
	) {
		return 'boolean';
	}

	// Number patterns
	if (
		upperKey.includes('_PORT') ||
		upperKey.includes('_TIMEOUT') ||
		upperKey.includes('_LIMIT') ||
		upperKey.includes('_COUNT') ||
		upperKey.includes('_SIZE') ||
		upperKey.includes('_MAX') ||
		upperKey.includes('_MIN') ||
		upperKey.includes('_INTERVAL') ||
		(defaultValue !== '' && /^\d+$/.test(defaultValue))
	) {
		return 'number';
	}

	return 'string';
}

/** Check if a value looks like a placeholder (e.g., "xxx", "your-api-key", "<value>"). */
function isPlaceholder(value: string): boolean {
	const lower = value.toLowerCase();
	return (
		lower.startsWith('your-') ||
		lower.startsWith('your_') ||
		lower.startsWith('<') ||
		lower.startsWith('sk-xxx') ||
		lower === 'xxx' ||
		lower === 'changeme' ||
		lower === 'replace-me' ||
		lower === 'todo'
	);
}
