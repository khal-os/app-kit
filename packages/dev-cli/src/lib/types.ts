/**
 * Shape returned by /api/health on the KhalOS Next.js server.
 */
export interface HealthResponse {
	status: string;
	version: string;
	nats: { connected: boolean };
	uptime: number;
}
