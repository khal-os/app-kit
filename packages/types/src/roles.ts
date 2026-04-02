/** Canonical role hierarchy from least to most privileged. */
export const ROLE_HIERARCHY = ['member', 'platform-dev', 'platform-admin', 'platform-owner'] as const;
export type Role = (typeof ROLE_HIERARCHY)[number];
