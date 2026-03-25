import { sql } from 'drizzle-orm';
import { getDb } from './factory';

/**
 * Atomically claim a warm-pool instance for an org.
 * Uses FOR UPDATE SKIP LOCKED to avoid contention under concurrent requests.
 * Returns the claimed row, or null if no available instance matches.
 */
export async function claimWarmInstance(runtimeType: string, orgId: string) {
	const db = getDb();
	const result = await db.execute(sql`
		UPDATE warm_pool
		SET status = 'claimed', claimed_by = ${orgId}, claimed_at = NOW()
		WHERE id = (
			SELECT id FROM warm_pool
			WHERE status = 'available' AND runtime_type = ${runtimeType}
			ORDER BY created_at ASC
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		RETURNING *
	`);
	return result[0] ?? null;
}
