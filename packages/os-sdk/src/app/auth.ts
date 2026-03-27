'use client';

import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { getRolePermissions, normalizeRole } from './roles';

/** Authenticated user state returned by `useKhalAuth`. */
export interface KhalAuth {
	userId: string;
	orgId: string;
	role: string;
	permissions: string[];
	loading: boolean;
}

/**
 * Client-side hook that provides Khal auth state derived from the
 * WorkOS AuthKit session. Returns null when not authenticated.
 *
 * Role is normalized to a canonical platform slug via normalizeRole().
 * When no role is present, defaults to 'member' (least privilege).
 *
 * Permissions are derived from the normalized role using the role permissions
 * registry. Call `registerRolePermissions()` at startup to populate the mapping.
 */
export function useKhalAuth(): KhalAuth | null {
	const { user, role, loading } = useAuth();

	if (loading) {
		return { userId: '', orgId: '', role: '', permissions: [], loading: true };
	}

	if (!user) {
		// Local mode only: provide synthetic identity for npx khal-os
		// Enterprise instances (KHAL_MODE=team or unset) must authenticate via WorkOS
		if (process.env.NEXT_PUBLIC_KHAL_MODE === 'local') {
			const instanceId = process.env.NEXT_PUBLIC_KHAL_INSTANCE_ID || 'default';
			return {
				userId: 'local',
				orgId: instanceId,
				role: 'platform-owner',
				permissions: getRolePermissions('platform-owner'),
				loading: false,
			};
		}
		return null;
	}

	const effectiveRole = normalizeRole(role);
	const effectivePermissions = getRolePermissions(effectiveRole);

	const instanceId = process.env.NEXT_PUBLIC_KHAL_INSTANCE_ID;
	if (!instanceId) {
		// biome-ignore lint/suspicious/noConsole: startup diagnostic for missing env var
		console.error('[auth] NEXT_PUBLIC_KHAL_INSTANCE_ID is not set — NATS subjects will not match server');
	}

	return {
		userId: user.id,
		orgId: instanceId || 'default',
		role: effectiveRole,
		permissions: effectivePermissions,
		loading: false,
	};
}
