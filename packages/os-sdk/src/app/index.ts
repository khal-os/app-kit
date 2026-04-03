// Auth
export type { KhalAuth } from './auth';
export { useKhalAuth } from './auth';
// Auth context (for provider implementations)
export { KhalAuthContext } from './auth-context';

// Hooks
export { useNats, useNatsSubscription, useService } from './hooks';
// Manifest
export type {
	AppDeployConfig,
	AppDesktopConfig,
	AppEnvVar,
	AppManifest,
	AppManifestView,
	AppServiceConfig,
	AppTauriConfig,
	ManifestValidationResult,
	ServiceHealthConfig,
} from './manifest';
export { defineManifest, validateManifest } from './manifest';
// NATS client
export { getNatsClient } from './nats-client';
// Env example parser
export { parseEnvExample } from './parse-env-example';
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
