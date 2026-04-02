/**
 * Role hierarchy and normalization for Khal OS RBAC.
 *
 * Forward-compatible role slugs for Phase 1 (platform scope).
 * WorkOS auto-prefixes org roles with `org-` in Phase 2,
 * so platform roles use `platform-` prefix to avoid collisions.
 */

import type { Role } from '@khal-os/types';
import { ROLE_HIERARCHY } from '@khal-os/types';

export type { Role } from '@khal-os/types';
export { ROLE_HIERARCHY } from '@khal-os/types';

/**
 * Map legacy / shorthand role slugs to canonical platform role slugs.
 *
 * Used during migration (admin -> platform-admin) and for convenience
 * (dev -> platform-dev). WorkOS may return legacy slugs during the
 * transition period.
 */
const ROLE_ALIASES: Record<string, Role> = {
	// Legacy slugs (pre-Phase 1)
	admin: 'platform-admin',
	developer: 'platform-dev',
	owner: 'platform-owner',
	viewer: 'member',
	user: 'member',
	// Shorthand
	dev: 'platform-dev',
};

/**
 * Normalize a role string to a canonical platform role.
 *
 * Handles:
 * - Canonical slugs (returned as-is)
 * - Legacy slugs (mapped via ROLE_ALIASES)
 * - Unknown strings (defaults to 'member')
 */
export function normalizeRole(role: string | undefined | null): Role {
	if (!role) return 'member';
	if (ROLE_HIERARCHY.includes(role as Role)) return role as Role;
	return ROLE_ALIASES[role] ?? 'member';
}

/** Check if a role meets or exceeds the minimum required role level. */
export function hasMinRole(userRole: Role, minRole: Role): boolean {
	return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minRole);
}

// --- Role permissions registry ---

let _rolePermissions: Record<string, string[]> = {};

/**
 * Compute a role -> permissions mapping from a manifest of app entries.
 * Each role gets access to all apps whose `minRole` is at or below its level,
 * plus the `desktop` permission.
 */
export function computeRolePermissions(
	manifest: Record<string, { permission: string; minRole: Role }>
): Record<string, string[]> {
	return Object.fromEntries(
		ROLE_HIERARCHY.map((role) => {
			const roleLevel = ROLE_HIERARCHY.indexOf(role);
			const permissions = Object.values(manifest)
				.filter((app) => ROLE_HIERARCHY.indexOf(app.minRole) <= roleLevel)
				.map((app) => app.permission);
			return [role, [...permissions, 'desktop']];
		})
	);
}

/**
 * Register the role -> permissions mapping used by `useKhalAuth`.
 * Called once by the OS host at startup with the computed permissions.
 */
export function registerRolePermissions(perms: Record<string, string[]>): void {
	_rolePermissions = perms;
}

/** Get permissions for a given role. Returns empty array if no manifest is registered. */
export function getRolePermissions(role: string): string[] {
	return _rolePermissions[role] ?? [];
}
