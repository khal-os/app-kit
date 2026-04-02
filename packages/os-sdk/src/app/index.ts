// Auth
export type { KhalAuth } from './auth';
export { useKhalAuth } from './auth';
// Auth context (for provider implementations)
export { KhalAuthContext } from './auth-context';

// Hooks
export { useNats, useNatsSubscription, useService } from './hooks';
// Manifest
export type {
	AppDesktopConfig,
	AppManifest,
	AppManifestView,
	AppServiceConfig,
	ServiceHealthConfig,
} from './manifest';
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
