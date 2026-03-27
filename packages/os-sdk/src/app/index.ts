// Auth
export type { KhalAuth } from './auth';
export { useKhalAuth } from './auth';

// Hooks
export { useNats, useNatsSubscription } from './hooks';
// Manifest
export type { AppDesktopConfig, AppManifest, AppManifestView } from './manifest';
export { defineManifest } from './manifest';
// NATS client
export { getNatsClient } from './nats-client';
// Roles
export type { Role } from './roles';
export {
	computeRolePermissions,
	getRolePermissions,
	hasMinRole,
	normalizeRole,
	ROLE_HIERARCHY,
	registerRolePermissions,
} from './roles';
// Subject builder
export { SubjectBuilder } from './subject-builder';
// Subjects
export { SUBJECTS } from './subjects';
