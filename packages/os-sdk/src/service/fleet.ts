/**
 * Fleet Service — per-company instance lifecycle management.
 *
 * Each company (org) can have multiple KhalOS instances. Each instance maps to
 * one Runtime (local, docker, cloud, etc.) and its own database.
 *
 * Usage:
 *   import { fleet } from '@khal-os/sdk';
 *   const instance = await fleet.createInstance(orgId, { name: 'prod-1' });
 *   await fleet.startInstance(instance.id);
 */

import { existsSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from '../config';
import { claimWarmInstance } from '../db/claim';
import { getDb } from '../db/factory';
import type { NewAuditEvent } from '../db/schema/audit-events';
import { auditEvents } from '../db/schema/audit-events';
import type { Instance, NewInstance } from '../db/schema/instances';
import { instances } from '../db/schema/instances';
import { warmPool } from '../db/schema/warm-pool';
import { createRuntime } from '../runtime/factory';
import type { Runtime, RuntimeConfig, RuntimeHealth, RuntimeType } from '../runtime/types';

// ---------------------------------------------------------------------------
// In-memory runtime registry (process-scoped)
// ---------------------------------------------------------------------------

/** Active runtimes keyed by instance ID. */
const runtimeRegistry = new Map<string, Runtime>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateInstanceConfig {
	/** Human-readable name for the instance. */
	name: string;
	/** Runtime type — defaults to 'local'. */
	runtimeType?: RuntimeType;
	/** Partial runtime config overrides. */
	runtimeConfig?: Partial<Omit<RuntimeConfig, 'type'>>;
	/** Optional metadata (JSON). */
	metadata?: Record<string, unknown>;
}

export interface FleetService {
	createInstance(orgId: string, config: CreateInstanceConfig): Promise<Instance>;
	startInstance(instanceId: string): Promise<void>;
	stopInstance(instanceId: string): Promise<void>;
	deleteInstance(instanceId: string): Promise<void>;
	listInstances(orgId?: string): Promise<Instance[]>;
	getInstanceHealth(instanceId: string): Promise<RuntimeHealth>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getInstance(instanceId: string): Promise<Instance> {
	const db = getDb();
	const [row] = await db.select().from(instances).where(eq(instances.id, instanceId)).limit(1);
	if (!row) {
		throw new Error(`[fleet] Instance not found: ${instanceId}`);
	}
	return row;
}

async function setStatus(instanceId: string, status: Instance['status']): Promise<Instance> {
	const db = getDb();
	const [updated] = await db
		.update(instances)
		.set({ status, updatedAt: new Date() })
		.where(eq(instances.id, instanceId))
		.returning();
	if (!updated) {
		throw new Error(`[fleet] Instance not found during status update: ${instanceId}`);
	}
	return updated;
}

function buildRuntimeConfig(instance: Instance): RuntimeConfig {
	const stored = (instance.runtimeConfig as Partial<RuntimeConfig>) ?? {};
	return {
		type: instance.runtimeType as RuntimeType,
		projectRoot: stored.projectRoot ?? process.cwd(),
		...stored,
	};
}

async function getOrCreateRuntime(instance: Instance): Promise<Runtime> {
	let runtime = runtimeRegistry.get(instance.id);
	if (runtime) return runtime;

	const config = buildRuntimeConfig(instance);
	runtime = await createRuntime(config);
	runtimeRegistry.set(instance.id, runtime);
	return runtime;
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

type AuditEventType = 'instance.created' | 'instance.started' | 'instance.stopped' | 'instance.deleted';

async function emitAudit(
	eventType: AuditEventType,
	instanceId: string,
	orgId: string,
	details?: Record<string, unknown>
): Promise<void> {
	try {
		const db = getDb();
		const event: NewAuditEvent = {
			entityType: 'instance',
			entityId: instanceId,
			eventType,
			orgId,
			details: details ? { instanceId, orgId, ...details } : { instanceId, orgId },
		};
		await db.insert(auditEvents).values(event);
	} catch {
		// Audit failures must never break fleet operations.
	}
}

// ---------------------------------------------------------------------------
// Database provisioning
// ---------------------------------------------------------------------------

const HOST_MIGRATIONS_FOLDER = './drizzle';

/**
 * Generate a unique database name for an instance.
 */
function instanceDbName(instanceId: string): string {
	// Replace hyphens — Postgres identifiers can't contain them unquoted.
	return `genie_instance_${instanceId.replace(/-/g, '_')}`;
}

/**
 * Create a new database for an instance, run Drizzle migrations,
 * and return the connection string.
 */
async function provisionInstanceDb(instanceId: string): Promise<string> {
	const adminUrl = getDatabaseUrl();
	const dbName = instanceDbName(instanceId);

	// Use admin connection to CREATE DATABASE.
	const adminClient = postgres(adminUrl, { max: 1 });
	try {
		await adminClient.unsafe(`CREATE DATABASE "${dbName}"`);
	} finally {
		await adminClient.end();
	}

	// Build connection URL for the new database.
	const parsed = new URL(adminUrl);
	parsed.pathname = `/${dbName}`;
	const instanceUrl = parsed.toString();

	// Run Drizzle migrations on the new database if migrations exist.
	if (existsSync(`${HOST_MIGRATIONS_FOLDER}/meta/_journal.json`)) {
		const migrationClient = postgres(instanceUrl, { max: 1 });
		const migrationDb = drizzle(migrationClient);
		try {
			await migrate(migrationDb, { migrationsFolder: HOST_MIGRATIONS_FOLDER });
		} finally {
			await migrationClient.end();
		}
	}

	return instanceUrl;
}

/**
 * Drop an instance's database.
 */
async function dropInstanceDb(instanceId: string): Promise<void> {
	const adminUrl = getDatabaseUrl();
	const dbName = instanceDbName(instanceId);

	const adminClient = postgres(adminUrl, { max: 1 });
	try {
		// Terminate active connections before dropping.
		await adminClient.unsafe(
			`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`
		);
		await adminClient.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
	} finally {
		await adminClient.end();
	}
}

// ---------------------------------------------------------------------------
// Warm pool helpers
// ---------------------------------------------------------------------------

const WARM_POOL_LOW_THRESHOLD = 2;

/**
 * Check warm pool levels and log a warning if below threshold.
 */
async function checkWarmPoolLevels(runtimeType: string): Promise<void> {
	try {
		const db = getDb();
		const [result] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(warmPool)
			.where(eq(warmPool.status, 'available'));
		const available = result?.count ?? 0;
		if (available < WARM_POOL_LOW_THRESHOLD) {
			console.warn(
				`[fleet] Warm pool low for runtime type '${runtimeType}': ${available} available (threshold: ${WARM_POOL_LOW_THRESHOLD})`
			);
		}
	} catch {
		// Non-critical — don't break fleet operations.
	}
}

// ---------------------------------------------------------------------------
// Fleet operations
// ---------------------------------------------------------------------------

/**
 * Provision a new instance for an organization.
 *
 * 1. Try to claim a warm-pool instance (fast path).
 * 2. If no warm instance available, cold-provision a new one.
 * 3. Create a per-instance database and run migrations.
 * 4. Start the Runtime.
 * 5. Log an audit event.
 */
async function createInstance(orgId: string, config: CreateInstanceConfig): Promise<Instance> {
	const db = getDb();
	const runtimeType: RuntimeType = config.runtimeType ?? 'local';

	// --- Warm pool fast path ---
	const claimed = await claimWarmInstance(runtimeType, orgId);

	let inserted: Instance;

	if (claimed) {
		// Warm instance claimed — insert row referencing the pre-warmed runtime.
		const newRow: NewInstance = {
			orgId,
			name: config.name,
			runtimeType,
			runtimeConfig: { ...config.runtimeConfig, warmPoolRef: claimed.runtime_ref } as Record<string, unknown>,
			status: 'creating',
			metadata: config.metadata ?? null,
		};
		const [row] = await db.insert(instances).values(newRow).returning();
		if (!row) throw new Error('[fleet] Failed to insert instance row');
		inserted = row;
	} else {
		// Cold provision — create from scratch.
		const newRow: NewInstance = {
			orgId,
			name: config.name,
			runtimeType,
			runtimeConfig: config.runtimeConfig ?? null,
			status: 'creating',
			metadata: config.metadata ?? null,
		};
		const [row] = await db.insert(instances).values(newRow).returning();
		if (!row) throw new Error('[fleet] Failed to insert instance row');
		inserted = row;
	}

	try {
		// --- DB provisioning ---
		const databaseUrl = await provisionInstanceDb(inserted.id);

		// Store connection string in runtimeConfig.
		const updatedConfig = {
			...(inserted.runtimeConfig as Record<string, unknown> | null),
			databaseUrl,
		};
		await db
			.update(instances)
			.set({ runtimeConfig: updatedConfig, updatedAt: new Date() })
			.where(eq(instances.id, inserted.id));

		// Refresh the instance with the updated config.
		inserted = { ...inserted, runtimeConfig: updatedConfig };

		// --- Runtime provisioning ---
		const rtConfig = buildRuntimeConfig(inserted);
		const runtime = await createRuntime(rtConfig);
		runtimeRegistry.set(inserted.id, runtime);

		await runtime.start();

		const url = runtime.url();
		const [running] = await db
			.update(instances)
			.set({ status: 'running', url, updatedAt: new Date() })
			.where(eq(instances.id, inserted.id))
			.returning();

		const result = running ?? inserted;

		// --- Audit + warm pool monitoring ---
		await emitAudit('instance.created', result.id, orgId, {
			runtimeType,
			name: config.name,
			fromWarmPool: !!claimed,
		});
		await checkWarmPoolLevels(runtimeType);

		return result;
	} catch {
		// Mark as error but don't throw — instance exists for retry.
		await setStatus(inserted.id, 'error');
		const [errInstance] = await db.select().from(instances).where(eq(instances.id, inserted.id)).limit(1);
		return errInstance ?? inserted;
	}
}

/**
 * Start a stopped instance. Provisions a new Runtime and starts it.
 */
async function startInstance(instanceId: string): Promise<void> {
	const instance = await getInstance(instanceId);

	if (instance.status === 'running') {
		return; // Already running — idempotent.
	}
	if (instance.status === 'creating') {
		throw new Error(`[fleet] Instance ${instanceId} is still being created`);
	}

	const runtime = await getOrCreateRuntime(instance);
	await runtime.start();

	const url = runtime.url();
	const db = getDb();
	await db.update(instances).set({ status: 'running', url, updatedAt: new Date() }).where(eq(instances.id, instanceId));

	await emitAudit('instance.started', instanceId, instance.orgId, { runtimeType: instance.runtimeType });
}

/**
 * Stop a running instance gracefully.
 */
async function stopInstance(instanceId: string): Promise<void> {
	const instance = await getInstance(instanceId);

	if (instance.status === 'stopped') {
		return; // Already stopped — idempotent.
	}

	const runtime = runtimeRegistry.get(instanceId);
	if (runtime?.isRunning()) {
		await runtime.stop();
	}

	await setStatus(instanceId, 'stopped');
	await emitAudit('instance.stopped', instanceId, instance.orgId, { runtimeType: instance.runtimeType });
}

/**
 * Delete an instance — stops runtime, drops database, removes from DB.
 */
async function deleteInstance(instanceId: string): Promise<void> {
	const instance = await getInstance(instanceId);

	// Stop runtime if running.
	const runtime = runtimeRegistry.get(instanceId);
	if (runtime?.isRunning()) {
		await runtime.stop();
	}
	runtimeRegistry.delete(instanceId);

	// Drop the per-instance database.
	try {
		await dropInstanceDb(instanceId);
	} catch {
		// Log but don't fail — the DB might not have been provisioned (e.g., error during create).
		console.warn(`[fleet] Failed to drop database for instance ${instanceId} — may not exist`);
	}

	// Remove from DB.
	const db = getDb();
	await db.delete(instances).where(eq(instances.id, instanceId));

	await emitAudit('instance.deleted', instanceId, instance.orgId, { runtimeType: instance.runtimeType });
}

/**
 * List all instances, optionally filtered by organization.
 */
async function listInstances(orgId?: string): Promise<Instance[]> {
	const db = getDb();
	if (orgId) {
		return db.select().from(instances).where(eq(instances.orgId, orgId));
	}
	return db.select().from(instances);
}

/**
 * Get the health of a specific instance by delegating to its Runtime.
 */
async function getInstanceHealth(instanceId: string): Promise<RuntimeHealth> {
	const instance = await getInstance(instanceId);

	const runtime = runtimeRegistry.get(instanceId);
	if (!runtime) {
		return {
			status: instance.status === 'stopped' ? 'unknown' : 'unhealthy',
			services: [],
		};
	}

	return runtime.health();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const fleet: FleetService = {
	createInstance,
	startInstance,
	stopInstance,
	deleteInstance,
	listInstances,
	getInstanceHealth,
};
