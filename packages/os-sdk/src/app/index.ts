// Auth

// App Registry — RBAC data and static app manifest
export type { AppId, AppManifestEntry, AppStoreMeta } from './app-registry';
export {
	APP_MANIFEST,
	DEFAULT_ROLE_PERMISSIONS,
	getManifestEntry,
	getVoiceAgentSlug,
	getVoiceLabel,
	refreshRolePermissions,
	registerManifestEntry,
	SUBJECT_PERMISSIONS,
} from './app-registry';
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
export type { NatsClient } from './nats-client';
export { TauriNatsClient } from './nats-client';
export type {
	BrowserConfigReader,
	BrowserEnterpriseConfig,
} from './nats-client-browser';
export { BrowserNatsClient } from './nats-client-browser';
// NATS client — transport-agnostic factory + implementation classes
export { getNatsClient } from './nats-client-factory';
export type { NatsClientTransport } from './nats-client-transport';
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
// Sandbox
export type { SandboxState, SandboxStatus } from './sandbox';
export { createSandbox, deleteSandbox, getSandboxStatus, sandboxPtySubjects, useSandboxStatus } from './sandbox';
// Subject builder
export { SubjectBuilder } from './subject-builder';
// Subjects
export { SUBJECTS } from './subjects';
