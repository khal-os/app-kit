import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getInstance } from './instances.js';

const CONFIG_DIR_NAME = '.khal-os';
const CONFIG_FILE = 'config.json';
const CREDENTIALS_FILE = 'credentials.json';

const DEFAULT_INSTANCE = 'http://localhost:8888';

/* ---------- types ---------- */

export type CredentialType = 'api-key' | 'session';

export interface Credential {
	token: string;
	type: CredentialType;
}

interface ConfigFile {
	activeInstance: string;
}

type CredentialsFile = Record<string, Credential>;

/* ---------- directory helpers ---------- */

/** Returns `~/.khal-os/`, creating it if it does not exist. */
export function getConfigDir(): string {
	const dir = join(homedir(), CONFIG_DIR_NAME);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

function configPath(): string {
	return join(getConfigDir(), CONFIG_FILE);
}

function credentialsPath(): string {
	return join(getConfigDir(), CREDENTIALS_FILE);
}

/* ---------- JSON I/O ---------- */

function readJson<T>(path: string, fallback: T): T {
	if (!existsSync(path)) return fallback;
	try {
		return JSON.parse(readFileSync(path, 'utf-8')) as T;
	} catch {
		return fallback;
	}
}

function writeJson(path: string, data: unknown): void {
	writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

/* ---------- credentials ---------- */

/** Read all stored credentials keyed by instance URL. */
export function readCredentials(): CredentialsFile {
	return readJson<CredentialsFile>(credentialsPath(), {});
}

/** Persist a credential for the given instance URL. */
export function saveCredential(instanceUrl: string, token: string, type: CredentialType): void {
	const creds = readCredentials();
	creds[instanceUrl] = { token, type };
	writeJson(credentialsPath(), creds);
}

/** Remove a stored credential for the given instance URL. */
export function removeCredential(instanceUrl: string): void {
	const creds = readCredentials();
	delete creds[instanceUrl];
	writeJson(credentialsPath(), creds);
}

/** Return the credential for a specific instance, or `null` if none stored. */
export function getCredentialForInstance(instanceUrl: string): Credential | null {
	const creds = readCredentials();
	return creds[instanceUrl] ?? null;
}

/* ---------- active instance ---------- */

/** Get the currently configured active instance URL (or the default). */
export function getActiveInstance(): string {
	const cfg = readJson<ConfigFile>(configPath(), { activeInstance: DEFAULT_INSTANCE });
	return cfg.activeInstance;
}

/** Set the active instance URL in `config.json`. */
export function setActiveInstance(url: string): void {
	const cfg = readJson<ConfigFile>(configPath(), { activeInstance: DEFAULT_INSTANCE });
	cfg.activeInstance = url;
	writeJson(configPath(), cfg);
}

/* ---------- resolution ---------- */

/**
 * Resolve the target instance URL using the priority chain:
 *   1. Explicit `--instance` flag value (may be a URL or an instance name)
 *   2. `KHAL_INSTANCE` environment variable
 *   3. `config.json` active instance
 *   4. `http://localhost:8888` (default)
 */
export function resolveInstance(flagValue?: string): string {
	if (flagValue) {
		// If it looks like a URL, use directly
		if (flagValue.startsWith('http://') || flagValue.startsWith('https://')) return flagValue;
		// Otherwise, try to resolve as an instance name
		const inst = getInstance(flagValue);
		if (inst) return inst.url;
		// Fall through: treat as URL anyway (user may have typed a hostname)
		return flagValue;
	}
	if (process.env.KHAL_INSTANCE) return process.env.KHAL_INSTANCE;
	return getActiveInstance();
}
