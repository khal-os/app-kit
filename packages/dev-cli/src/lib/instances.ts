import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config.js';

/* ---------- types ---------- */

export interface InstanceConfig {
	name: string;
	url: string;
	provider: 'k3s' | 'oci' | 'docker' | 'local';
	registry?: string;
	dbHost?: string;
	dbPort?: number;
	dbUser?: string;
	dbName?: string;
	domain?: string;
	kubeconfig?: string;
	namespace?: string;
	helmChart?: string;
	sshHost?: string;
	sshUser?: string;
}

export type ProviderType = InstanceConfig['provider'];

export const PROVIDERS: ProviderType[] = ['local', 'k3s', 'oci', 'docker'];

/* ---------- directory helpers ---------- */

/** Returns `~/.khal-os/instances/`, creating it if it does not exist. */
export function getInstancesDir(): string {
	const dir = join(getConfigDir(), 'instances');
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

/* ---------- CRUD ---------- */

/** List all saved instance profiles. */
export function listInstances(): InstanceConfig[] {
	const dir = getInstancesDir();
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
	const instances: InstanceConfig[] = [];
	for (const file of files) {
		try {
			const raw = readFileSync(join(dir, file), 'utf-8');
			instances.push(JSON.parse(raw) as InstanceConfig);
		} catch {
			// skip corrupt files
		}
	}
	return instances;
}

/** Get a single instance by name, or `null` if it doesn't exist. */
export function getInstance(name: string): InstanceConfig | null {
	const filePath = join(getInstancesDir(), `${name}.json`);
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, 'utf-8')) as InstanceConfig;
	} catch {
		return null;
	}
}

/** Save an instance profile to `~/.khal-os/instances/<name>.json`. */
export function saveInstance(config: InstanceConfig): void {
	const filePath = join(getInstancesDir(), `${config.name}.json`);
	writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

/** Remove an instance profile by name. Returns true if the file existed. */
export function removeInstance(name: string): boolean {
	const filePath = join(getInstancesDir(), `${name}.json`);
	if (!existsSync(filePath)) return false;
	rmSync(filePath);
	return true;
}
