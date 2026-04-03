import type { AppManifest } from '@khal-os/types';

export type {
	AppDeployConfig,
	AppDesktopConfig,
	AppEnvVar,
	AppManifest,
	AppManifestView,
	AppServiceConfig,
	AppTauriConfig,
	ServiceHealthConfig,
} from '@khal-os/types';

export function defineManifest<T extends AppManifest>(manifest: T): T {
	return manifest;
}

/** Validation result from validateManifest. */
export interface ManifestValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Validate a parsed khal-app.json object against the v2 schema.
 *
 * This is a lightweight structural validator — it checks required fields,
 * types, and basic constraints without requiring a full JSON Schema library.
 * For install-time validation in the marketplace.
 */
export function validateManifest(json: unknown): ManifestValidationResult {
	const errors: string[] = [];

	if (typeof json !== 'object' || json === null || Array.isArray(json)) {
		return { valid: false, errors: ['Manifest must be a JSON object'] };
	}

	const m = json as Record<string, unknown>;

	// Required fields
	if (typeof m.id !== 'string' || m.id.length === 0) {
		errors.push('Missing or invalid "id": must be a non-empty string');
	} else if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id)) {
		errors.push(`Invalid "id": "${m.id}" must be lowercase alphanumeric with hyphens`);
	}

	if (!Array.isArray(m.views)) {
		errors.push('Missing or invalid "views": must be an array');
	} else {
		for (let i = 0; i < m.views.length; i++) {
			const v = m.views[i] as Record<string, unknown>;
			if (typeof v !== 'object' || v === null) {
				errors.push(`views[${i}]: must be an object`);
				continue;
			}
			if (typeof v.id !== 'string') errors.push(`views[${i}].id: must be a string`);
			if (typeof v.label !== 'string') errors.push(`views[${i}].label: must be a string`);
			if (typeof v.component !== 'string') errors.push(`views[${i}].component: must be a string`);
		}
	}

	if (typeof m.desktop !== 'object' || m.desktop === null) {
		errors.push('Missing or invalid "desktop": must be an object');
	} else {
		const d = m.desktop as Record<string, unknown>;
		if (typeof d.icon !== 'string') errors.push('desktop.icon: must be a string');
		if (!Array.isArray(d.categories)) errors.push('desktop.categories: must be an array');
		if (typeof d.comment !== 'string') errors.push('desktop.comment: must be a string');
	}

	// Optional typed fields
	if (m.schemaVersion !== undefined && typeof m.schemaVersion !== 'number') {
		errors.push('"schemaVersion": must be a number');
	}

	if (m.services !== undefined) {
		if (!Array.isArray(m.services)) {
			errors.push('"services": must be an array');
		} else {
			for (let i = 0; i < m.services.length; i++) {
				const s = m.services[i] as Record<string, unknown>;
				if (typeof s !== 'object' || s === null) {
					errors.push(`services[${i}]: must be an object`);
					continue;
				}
				if (typeof s.name !== 'string') errors.push(`services[${i}].name: must be a string`);
				if (!s.entry && !s.command) errors.push(`services[${i}]: must have "entry" or "command"`);
			}
		}
	}

	if (m.env !== undefined) {
		if (!Array.isArray(m.env)) {
			errors.push('"env": must be an array');
		} else {
			for (let i = 0; i < m.env.length; i++) {
				const e = m.env[i] as Record<string, unknown>;
				if (typeof e !== 'object' || e === null) {
					errors.push(`env[${i}]: must be an object`);
					continue;
				}
				if (typeof e.key !== 'string') errors.push(`env[${i}].key: must be a string`);
				if (typeof e.required !== 'boolean') errors.push(`env[${i}].required: must be a boolean`);
			}
		}
	}

	if (m.deploy !== undefined && (typeof m.deploy !== 'object' || m.deploy === null)) {
		errors.push('"deploy": must be an object');
	}

	if (m.tauri !== undefined) {
		if (typeof m.tauri !== 'object' || m.tauri === null) {
			errors.push('"tauri": must be an object');
		} else {
			const t = m.tauri as Record<string, unknown>;
			if (typeof t.exportable !== 'boolean') errors.push('tauri.exportable: must be a boolean');
		}
	}

	return { valid: errors.length === 0, errors };
}
