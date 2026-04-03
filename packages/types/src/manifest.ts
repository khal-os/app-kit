import type { Role } from './roles';

/** Desktop integration metadata for an app. */
export interface AppDesktopConfig {
	/** Path to the app icon (relative to the public directory). */
	icon: string;
	/** Categories for desktop launcher grouping. */
	categories: string[];
	/** Short description shown in the desktop launcher. */
	comment: string;
}

/** A single view within an app manifest. */
export interface AppManifestView {
	/** Unique view identifier within the app. */
	id: string;
	/** Human-readable label for the view. */
	label: string;
	/** Permission string required to access this view. */
	permission: string;
	/** Minimum role level required. */
	minRole: Role;
	/** NATS subject segment after `khal.<orgId>.` for this view's services. */
	natsPrefix?: string;
	/** Default window dimensions. */
	defaultSize: { width: number; height: number };
	/** Relative path to the view's React component. */
	component: string;
}

/** Health check configuration for a service. */
export interface ServiceHealthConfig {
	/** Check type: tcp (connect to port), http (GET endpoint), command (run shell). */
	type: 'tcp' | 'http' | 'command';
	/** Target: port number for tcp, URL for http, shell command for command. */
	target: string | number;
	/** Check interval in milliseconds (default: 30000). */
	interval?: number;
	/** Timeout in milliseconds (default: 5000). */
	timeout?: number;
}

/** Service declaration within an app manifest. */
export interface AppServiceConfig {
	/** Service name (must be unique across the app). */
	name: string;
	/** Shell command to start the service (alternative to entry). */
	command?: string;
	/** Entry point file path relative to the package root. */
	entry?: string;
	/** Runtime environment. */
	runtime?: 'node' | 'python';
	/** Health check configuration. */
	health?: ServiceHealthConfig;
	/** Restart policy. */
	restart?: 'always' | 'on-failure' | 'never';
	/** Ports the service binds to internally. Khal assigns proxy ports. */
	ports?: number[];
}

/** Environment variable declaration for app configuration. */
export interface AppEnvVar {
	/** Variable name (e.g., "API_KEY"). */
	key: string;
	/** Human-readable description shown in the config UI. */
	description: string;
	/** Whether the variable is required for the app to run. */
	required: boolean;
	/** Default value if not configured. */
	default?: string;
	/** Value type — affects config UI rendering and validation. */
	type?: 'string' | 'number' | 'boolean' | 'secret' | 'url';
	/** Storage: 'config' for plain ConfigMap, 'vault' for Kubernetes Secret. */
	visibility?: 'config' | 'vault';
}

/** Kubernetes deployment configuration for apps with backends. */
export interface AppDeployConfig {
	/** Dockerfile path relative to app root (default: "Dockerfile"). */
	dockerfile?: string;
	/** Build args passed to docker build. */
	buildArgs?: Record<string, string>;
	/** Container port the app listens on. */
	port?: number;
	/** Resource requests and limits for the pod. */
	resources?: {
		requests?: { cpu?: string; memory?: string };
		limits?: { cpu?: string; memory?: string };
	};
	/** Replica count (default: 1). */
	replicas?: number;
	/** Health check path for k8s readiness/liveness probes. */
	healthPath?: string;
	/** Ingress configuration for per-app routing. */
	ingress?: {
		/** Subdomain prefix: <value>.apps.<domain>. Defaults to app id. */
		subdomain?: string;
		/** Additional path prefixes to route to this app. */
		pathPrefixes?: string[];
	};
	/** Horizontal Pod Autoscaler configuration. */
	autoscaling?: {
		enabled: boolean;
		minReplicas?: number;
		maxReplicas?: number;
		targetCPU?: number;
	};
	/** Environment sources injected at runtime from k8s resources. */
	envFrom?: Array<{ secretRef?: string; configMapRef?: string }>;
}

/** Tauri standalone export configuration. */
export interface AppTauriConfig {
	/** Whether this app supports standalone Tauri export. */
	exportable: boolean;
	/** Path to src-tauri/ directory (default: "./src-tauri"). */
	tauriDir?: string;
	/** App name for the exported binary. */
	appName?: string;
	/** App icon path relative to app root. */
	icon?: string;
	/** Window configuration for standalone mode. */
	window?: { width?: number; height?: number; title?: string };
}

/**
 * Full app manifest — the type for `manifest.ts` files in KhalOS app packages.
 *
 * Every app package must export a default manifest conforming to this shape.
 * Use `defineManifest()` for compile-time validation and autocomplete.
 *
 * The JSON equivalent (`khal-app.json`) uses the same shape and is the
 * language-agnostic install-time contract that the marketplace reads.
 */
export interface AppManifest {
	/** Unique app identifier (must match the package directory name). */
	id: string;
	/** One or more views the app exposes. */
	views: AppManifestView[];
	/** Desktop integration configuration. */
	desktop: AppDesktopConfig;
	/** Backend services this app runs. Optional — pure UI apps have no services. */
	services?: AppServiceConfig[];

	// ── v2 fields (all optional for backward compatibility) ──

	/** Schema version for forward compatibility (default: 1). */
	schemaVersion?: number;
	/** Human-readable app name. */
	name?: string;
	/** Semantic version of the app. */
	version?: string;
	/** Short description for the marketplace listing. */
	description?: string;
	/** Author name or organization. */
	author?: string;
	/** SPDX license identifier. */
	license?: string;
	/** Source repository URL. */
	repository?: string;
	/** Minimum KhalOS host version required. */
	minHostVersion?: string;
	/** Environment variables the app needs — auto-generates config UI. */
	env?: AppEnvVar[];
	/** Native Kubernetes deployment configuration. */
	deploy?: AppDeployConfig;
	/** Tauri standalone export configuration. */
	tauri?: AppTauriConfig;
}
