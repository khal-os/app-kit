/**
 * Comprehensive manifest validator for khal-app.json.
 *
 * Validates a parsed JSON object against the KhalOS app manifest schema
 * with human-readable error messages. No external dependencies (no ajv).
 *
 * This module is the canonical validator — manifest.ts re-exports from here.
 */

const VALID_ROLES = ['member', 'platform-dev', 'platform-admin', 'platform-owner'] as const;
const VALID_RUNTIMES = ['node', 'python'] as const;
const VALID_HEALTH_TYPES = ['tcp', 'http', 'command'] as const;
const VALID_RESTART_POLICIES = ['always', 'on-failure', 'never'] as const;
const VALID_ENV_TYPES = ['string', 'number', 'boolean', 'secret', 'url'] as const;
const VALID_VISIBILITY = ['config', 'vault'] as const;

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Result returned by {@link validateManifest}. */
export interface ManifestValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Validate a parsed khal-app.json object against the v2 schema.
 *
 * Checks required fields, types, enum values, nested structures, and basic
 * constraints without requiring a full JSON Schema library. Intended for
 * install-time validation in the marketplace and CLI tooling.
 */
export function validateManifest(json: unknown): ManifestValidationResult {
	const errors: string[] = [];

	if (typeof json !== 'object' || json === null || Array.isArray(json)) {
		return { valid: false, errors: ['Manifest must be a JSON object'] };
	}

	const m = json as Record<string, unknown>;

	// ── Required top-level fields ──────────────────────────────────────

	// id (required)
	if (typeof m.id !== 'string' || m.id.length === 0) {
		errors.push('Missing or invalid "id": must be a non-empty string');
	} else if (!APP_ID_PATTERN.test(m.id)) {
		errors.push(`Invalid "id": "${m.id}" must be lowercase alphanumeric with hyphens, starting with [a-z0-9]`);
	}

	// views (required)
	if (!Array.isArray(m.views)) {
		errors.push('Missing or invalid "views": must be an array');
	} else {
		validateViews(m.views, errors);
	}

	// desktop (required)
	if (typeof m.desktop !== 'object' || m.desktop === null || Array.isArray(m.desktop)) {
		errors.push('Missing or invalid "desktop": must be an object');
	} else {
		validateDesktop(m.desktop as Record<string, unknown>, errors);
	}

	// ── Optional typed fields ──────────────────────────────────────────

	if (m.schemaVersion !== undefined && typeof m.schemaVersion !== 'number') {
		errors.push('"schemaVersion": must be a number');
	}

	if (m.name !== undefined && typeof m.name !== 'string') {
		errors.push('"name": must be a string');
	}

	if (m.version !== undefined && typeof m.version !== 'string') {
		errors.push('"version": must be a string');
	}

	if (m.description !== undefined && typeof m.description !== 'string') {
		errors.push('"description": must be a string');
	}

	if (m.author !== undefined && typeof m.author !== 'string') {
		errors.push('"author": must be a string');
	}

	if (m.license !== undefined && typeof m.license !== 'string') {
		errors.push('"license": must be a string');
	}

	if (m.repository !== undefined && typeof m.repository !== 'string') {
		errors.push('"repository": must be a string');
	}

	if (m.minHostVersion !== undefined && typeof m.minHostVersion !== 'string') {
		errors.push('"minHostVersion": must be a string');
	}

	// ── services (optional array) ──────────────────────────────────────

	if (m.services !== undefined) {
		if (!Array.isArray(m.services)) {
			errors.push('"services": must be an array');
		} else {
			validateServices(m.services, errors);
		}
	}

	// ── env (optional array) ───────────────────────────────────────────

	if (m.env !== undefined) {
		if (!Array.isArray(m.env)) {
			errors.push('"env": must be an array');
		} else {
			validateEnv(m.env, errors);
		}
	}

	// ── deploy (optional object) ───────────────────────────────────────

	if (m.deploy !== undefined) {
		if (typeof m.deploy !== 'object' || m.deploy === null || Array.isArray(m.deploy)) {
			errors.push('"deploy": must be an object');
		} else {
			validateDeploy(m.deploy as Record<string, unknown>, errors);
		}
	}

	// ── tauri (optional object) ────────────────────────────────────────

	if (m.tauri !== undefined) {
		if (typeof m.tauri !== 'object' || m.tauri === null || Array.isArray(m.tauri)) {
			errors.push('"tauri": must be an object');
		} else {
			validateTauri(m.tauri as Record<string, unknown>, errors);
		}
	}

	return { valid: errors.length === 0, errors };
}

// ── Nested validators ────────────────────────────────────────────────────

function validateViews(views: unknown[], errors: string[]): void {
	for (let i = 0; i < views.length; i++) {
		const v = views[i];
		if (typeof v !== 'object' || v === null || Array.isArray(v)) {
			errors.push(`views[${i}]: must be an object`);
			continue;
		}
		const view = v as Record<string, unknown>;

		if (typeof view.id !== 'string') errors.push(`views[${i}].id: must be a string`);
		if (typeof view.label !== 'string') errors.push(`views[${i}].label: must be a string`);
		if (typeof view.permission !== 'string') errors.push(`views[${i}].permission: must be a string`);
		if (typeof view.component !== 'string') errors.push(`views[${i}].component: must be a string`);

		if (view.minRole !== undefined) {
			if (typeof view.minRole !== 'string' || !(VALID_ROLES as readonly string[]).includes(view.minRole)) {
				errors.push(`views[${i}].minRole: must be one of ${VALID_ROLES.join(', ')} (got "${String(view.minRole)}")`);
			}
		}

		if (view.natsPrefix !== undefined && typeof view.natsPrefix !== 'string') {
			errors.push(`views[${i}].natsPrefix: must be a string`);
		}

		if (view.defaultSize !== undefined) {
			if (typeof view.defaultSize !== 'object' || view.defaultSize === null) {
				errors.push(`views[${i}].defaultSize: must be an object with width and height`);
			} else {
				const ds = view.defaultSize as Record<string, unknown>;
				if (typeof ds.width !== 'number') errors.push(`views[${i}].defaultSize.width: must be a number`);
				if (typeof ds.height !== 'number') errors.push(`views[${i}].defaultSize.height: must be a number`);
			}
		}
	}
}

function validateDesktop(d: Record<string, unknown>, errors: string[]): void {
	if (typeof d.icon !== 'string') errors.push('desktop.icon: must be a string');
	if (!Array.isArray(d.categories)) {
		errors.push('desktop.categories: must be an array');
	} else {
		for (let i = 0; i < d.categories.length; i++) {
			if (typeof d.categories[i] !== 'string') {
				errors.push(`desktop.categories[${i}]: must be a string`);
			}
		}
	}
	if (typeof d.comment !== 'string') errors.push('desktop.comment: must be a string');
}

function validateServices(services: unknown[], errors: string[]): void {
	const names = new Set<string>();

	for (let i = 0; i < services.length; i++) {
		const s = services[i];
		if (typeof s !== 'object' || s === null || Array.isArray(s)) {
			errors.push(`services[${i}]: must be an object`);
			continue;
		}
		const svc = s as Record<string, unknown>;

		if (typeof svc.name !== 'string') {
			errors.push(`services[${i}].name: must be a string`);
		} else {
			if (names.has(svc.name)) {
				errors.push(`services[${i}].name: duplicate service name "${svc.name}"`);
			}
			names.add(svc.name);
		}

		if (!svc.entry && !svc.command) {
			errors.push(`services[${i}]: must have "entry" or "command"`);
		}
		if (svc.entry !== undefined && typeof svc.entry !== 'string') {
			errors.push(`services[${i}].entry: must be a string`);
		}
		if (svc.command !== undefined && typeof svc.command !== 'string') {
			errors.push(`services[${i}].command: must be a string`);
		}

		if (svc.runtime !== undefined) {
			if (typeof svc.runtime !== 'string' || !(VALID_RUNTIMES as readonly string[]).includes(svc.runtime)) {
				errors.push(
					`services[${i}].runtime: must be one of ${VALID_RUNTIMES.join(', ')} (got "${String(svc.runtime)}")`
				);
			}
		}

		if (svc.restart !== undefined) {
			if (typeof svc.restart !== 'string' || !(VALID_RESTART_POLICIES as readonly string[]).includes(svc.restart)) {
				errors.push(
					`services[${i}].restart: must be one of ${VALID_RESTART_POLICIES.join(', ')} (got "${String(svc.restart)}")`
				);
			}
		}

		if (svc.ports !== undefined) {
			if (!Array.isArray(svc.ports)) {
				errors.push(`services[${i}].ports: must be an array`);
			} else {
				for (let j = 0; j < svc.ports.length; j++) {
					if (typeof svc.ports[j] !== 'number') {
						errors.push(`services[${i}].ports[${j}]: must be a number`);
					}
				}
			}
		}

		if (svc.health !== undefined) {
			if (typeof svc.health !== 'object' || svc.health === null || Array.isArray(svc.health)) {
				errors.push(`services[${i}].health: must be an object`);
			} else {
				validateHealth(svc.health as Record<string, unknown>, `services[${i}].health`, errors);
			}
		}
	}
}

function validateHealth(h: Record<string, unknown>, prefix: string, errors: string[]): void {
	if (typeof h.type !== 'string' || !(VALID_HEALTH_TYPES as readonly string[]).includes(h.type)) {
		errors.push(`${prefix}.type: must be one of ${VALID_HEALTH_TYPES.join(', ')} (got "${String(h.type)}")`);
	}

	if (h.target === undefined) {
		errors.push(`${prefix}.target: required`);
	} else if (typeof h.target !== 'string' && typeof h.target !== 'number') {
		errors.push(`${prefix}.target: must be a string or number`);
	}

	if (h.interval !== undefined && typeof h.interval !== 'number') {
		errors.push(`${prefix}.interval: must be a number`);
	}
	if (h.timeout !== undefined && typeof h.timeout !== 'number') {
		errors.push(`${prefix}.timeout: must be a number`);
	}
}

function validateEnv(env: unknown[], errors: string[]): void {
	const keys = new Set<string>();

	for (let i = 0; i < env.length; i++) {
		const e = env[i];
		if (typeof e !== 'object' || e === null || Array.isArray(e)) {
			errors.push(`env[${i}]: must be an object`);
			continue;
		}
		const envVar = e as Record<string, unknown>;

		if (typeof envVar.key !== 'string') {
			errors.push(`env[${i}].key: must be a string`);
		} else {
			if (keys.has(envVar.key)) {
				errors.push(`env[${i}].key: duplicate env key "${envVar.key}"`);
			}
			keys.add(envVar.key);
		}

		if (typeof envVar.description !== 'string') {
			errors.push(`env[${i}].description: must be a string`);
		}

		if (typeof envVar.required !== 'boolean') {
			errors.push(`env[${i}].required: must be a boolean`);
		}

		if (envVar.default !== undefined && typeof envVar.default !== 'string') {
			errors.push(`env[${i}].default: must be a string`);
		}

		if (envVar.type !== undefined) {
			if (typeof envVar.type !== 'string' || !(VALID_ENV_TYPES as readonly string[]).includes(envVar.type)) {
				errors.push(`env[${i}].type: must be one of ${VALID_ENV_TYPES.join(', ')} (got "${String(envVar.type)}")`);
			}
		}

		if (envVar.visibility !== undefined) {
			if (
				typeof envVar.visibility !== 'string' ||
				!(VALID_VISIBILITY as readonly string[]).includes(envVar.visibility)
			) {
				errors.push(
					`env[${i}].visibility: must be one of ${VALID_VISIBILITY.join(', ')} (got "${String(envVar.visibility)}")`
				);
			}
		}
	}
}

function validateDeploy(d: Record<string, unknown>, errors: string[]): void {
	if (d.dockerfile !== undefined && typeof d.dockerfile !== 'string') {
		errors.push('deploy.dockerfile: must be a string');
	}
	if (d.buildArgs !== undefined) {
		if (typeof d.buildArgs !== 'object' || d.buildArgs === null || Array.isArray(d.buildArgs)) {
			errors.push('deploy.buildArgs: must be an object');
		}
	}
	if (d.port !== undefined && typeof d.port !== 'number') {
		errors.push('deploy.port: must be a number');
	}
	if (d.replicas !== undefined && typeof d.replicas !== 'number') {
		errors.push('deploy.replicas: must be a number');
	}
	if (d.healthPath !== undefined && typeof d.healthPath !== 'string') {
		errors.push('deploy.healthPath: must be a string');
	}

	if (d.resources !== undefined) {
		if (typeof d.resources !== 'object' || d.resources === null || Array.isArray(d.resources)) {
			errors.push('deploy.resources: must be an object');
		}
	}

	if (d.ingress !== undefined) {
		if (typeof d.ingress !== 'object' || d.ingress === null || Array.isArray(d.ingress)) {
			errors.push('deploy.ingress: must be an object');
		} else {
			const ing = d.ingress as Record<string, unknown>;
			if (ing.subdomain !== undefined && typeof ing.subdomain !== 'string') {
				errors.push('deploy.ingress.subdomain: must be a string');
			}
			if (ing.pathPrefixes !== undefined && !Array.isArray(ing.pathPrefixes)) {
				errors.push('deploy.ingress.pathPrefixes: must be an array');
			}
		}
	}

	if (d.autoscaling !== undefined) {
		if (typeof d.autoscaling !== 'object' || d.autoscaling === null || Array.isArray(d.autoscaling)) {
			errors.push('deploy.autoscaling: must be an object');
		} else {
			const as_ = d.autoscaling as Record<string, unknown>;
			if (typeof as_.enabled !== 'boolean') {
				errors.push('deploy.autoscaling.enabled: must be a boolean');
			}
			if (as_.minReplicas !== undefined && typeof as_.minReplicas !== 'number') {
				errors.push('deploy.autoscaling.minReplicas: must be a number');
			}
			if (as_.maxReplicas !== undefined && typeof as_.maxReplicas !== 'number') {
				errors.push('deploy.autoscaling.maxReplicas: must be a number');
			}
			if (as_.targetCPU !== undefined && typeof as_.targetCPU !== 'number') {
				errors.push('deploy.autoscaling.targetCPU: must be a number');
			}
		}
	}

	if (d.envFrom !== undefined) {
		if (!Array.isArray(d.envFrom)) {
			errors.push('deploy.envFrom: must be an array');
		}
	}
}

function validateTauri(t: Record<string, unknown>, errors: string[]): void {
	if (typeof t.exportable !== 'boolean') {
		errors.push('tauri.exportable: must be a boolean');
	}
	if (t.tauriDir !== undefined && typeof t.tauriDir !== 'string') {
		errors.push('tauri.tauriDir: must be a string');
	}
	if (t.appName !== undefined && typeof t.appName !== 'string') {
		errors.push('tauri.appName: must be a string');
	}
	if (t.icon !== undefined && typeof t.icon !== 'string') {
		errors.push('tauri.icon: must be a string');
	}
	if (t.window !== undefined) {
		if (typeof t.window !== 'object' || t.window === null || Array.isArray(t.window)) {
			errors.push('tauri.window: must be an object');
		} else {
			const w = t.window as Record<string, unknown>;
			if (w.width !== undefined && typeof w.width !== 'number') errors.push('tauri.window.width: must be a number');
			if (w.height !== undefined && typeof w.height !== 'number') errors.push('tauri.window.height: must be a number');
			if (w.title !== undefined && typeof w.title !== 'string') errors.push('tauri.window.title: must be a string');
		}
	}
}
