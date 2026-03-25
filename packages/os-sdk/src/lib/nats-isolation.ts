/**
 * NATS Instance Isolation — subject prefix helpers.
 *
 * Every instance gets its own NATS subject namespace: `instance.<instanceId>.>`
 * This module provides helpers to build prefixed subjects and validate access.
 *
 * Usage:
 *   import { instanceSubject, validateInstanceAccess } from '@khal-os/sdk';
 *
 *   const subject = instanceSubject('abc-123', 'os.pty.create');
 *   // => 'instance.abc-123.os.pty.create'
 *
 *   validateInstanceAccess('abc-123', 'instance.abc-123.os.pty.create');
 *   // => true
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Prefix template for instance-scoped NATS subjects. */
export const INSTANCE_SUBJECT_PREFIX = 'instance';

/** Wildcard subscription pattern for all subjects within an instance. */
export function instanceWildcard(instanceId: string): string {
	return `${INSTANCE_SUBJECT_PREFIX}.${instanceId}.>`;
}

// ---------------------------------------------------------------------------
// Subject helpers
// ---------------------------------------------------------------------------

/**
 * Build an instance-scoped NATS subject.
 *
 * @param instanceId - The instance UUID.
 * @param subject - The original (non-prefixed) subject, e.g. 'os.pty.create'.
 * @returns The prefixed subject: `instance.<instanceId>.<subject>`
 */
export function instanceSubject(instanceId: string, subject: string): string {
	if (!instanceId) {
		throw new Error('[nats-isolation] instanceId is required');
	}
	if (!subject) {
		throw new Error('[nats-isolation] subject is required');
	}
	return `${INSTANCE_SUBJECT_PREFIX}.${instanceId}.${subject}`;
}

/**
 * Extract the instance ID from a prefixed NATS subject.
 *
 * @param subject - A prefixed subject like 'instance.abc-123.os.pty.create'
 * @returns The instance ID, or null if the subject is not instance-scoped.
 */
export function extractInstanceId(subject: string): string | null {
	if (!subject.startsWith(`${INSTANCE_SUBJECT_PREFIX}.`)) {
		return null;
	}
	const parts = subject.split('.');
	// At minimum: 'instance', '<id>', '<one-token>'
	if (parts.length < 3) {
		return null;
	}
	return parts[1];
}

/**
 * Strip the instance prefix from a subject, returning the original subject.
 *
 * @param subject - A prefixed subject like 'instance.abc-123.os.pty.create'
 * @returns The original subject 'os.pty.create', or the input unchanged if not prefixed.
 */
export function stripInstancePrefix(subject: string): string {
	const id = extractInstanceId(subject);
	if (!id) return subject;
	// Remove 'instance.<id>.'
	const prefix = `${INSTANCE_SUBJECT_PREFIX}.${id}.`;
	return subject.slice(prefix.length);
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * Validate that a NATS subject belongs to the specified instance.
 *
 * @param instanceId - The instance that the caller claims to own.
 * @param subject - The NATS subject being accessed.
 * @returns true if the subject is within the instance's namespace.
 */
export function validateInstanceAccess(instanceId: string, subject: string): boolean {
	const prefix = `${INSTANCE_SUBJECT_PREFIX}.${instanceId}.`;
	return subject.startsWith(prefix);
}

/**
 * Check if a subject is instance-scoped (has the instance prefix).
 */
export function isInstanceScoped(subject: string): boolean {
	return subject.startsWith(`${INSTANCE_SUBJECT_PREFIX}.`);
}

// ---------------------------------------------------------------------------
// NATS authorization config generator
// ---------------------------------------------------------------------------

/**
 * Generate NATS authorization rules for an instance.
 * Returns publish and subscribe permissions for the instance's subject namespace.
 *
 * Can be used with NATS account-level authorization or embedded token permissions.
 */
export function instanceAuthConfig(instanceId: string): {
	publish: { allow: string[] };
	subscribe: { allow: string[] };
} {
	const wildcard = instanceWildcard(instanceId);
	return {
		publish: { allow: [wildcard] },
		subscribe: { allow: [wildcard] },
	};
}
