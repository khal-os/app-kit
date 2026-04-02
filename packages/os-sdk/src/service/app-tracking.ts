/**
 * App run tracking SDK — instrument any app/agent/automation execution.
 *
 * Usage:
 *   const runId = await trackRun(nc, 'my-app', { trigger: 'manual', userId: 'u1' });
 *   // ... do work ...
 *   await endRun(nc, runId, { status: 'success', outputSummary: 'Done' });
 */

const SUBJECTS = {
	runStart: 'os.genie.apps.run.start',
	runEnd: 'os.genie.apps.run.end',
};

interface TrackRunOpts {
	trigger?: 'manual' | 'scheduled' | 'agent' | 'automation';
	userId?: string;
	agentId?: string;
	automationId?: string;
	appVersion?: string;
	metadata?: unknown;
}

interface EndRunOpts {
	status: 'success' | 'failure' | 'error' | 'timeout';
	costTokens?: number;
	costComputeMs?: number;
	costApiCalls?: number;
	outputSummary?: string;
	agentTrace?: unknown;
	metadata?: unknown;
}

interface NatsLike {
	request(subject: string, data?: Uint8Array, opts?: { timeout?: number }): Promise<{ data: Uint8Array }>;
}

function encode(data: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(data));
}

function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

/**
 * Start tracking an app run. Returns the runId for later completion.
 */
export async function trackRun(nc: NatsLike, appId: string, opts: TrackRunOpts = {}): Promise<string> {
	const resp = await nc.request(
		SUBJECTS.runStart,
		encode({
			appId,
			trigger: opts.trigger ?? 'manual',
			userId: opts.userId,
			agentId: opts.agentId,
			automationId: opts.automationId,
			appVersion: opts.appVersion,
			metadata: opts.metadata,
		}),
		{ timeout: 5000 }
	);
	const result = JSON.parse(decode(resp.data)) as { ok: boolean; runId: string; error?: string };
	if (!result.ok) throw new Error(result.error ?? 'Failed to start run tracking');
	return result.runId;
}

/**
 * End a tracked run with result information.
 */
export async function endRun(nc: NatsLike, runId: string, opts: EndRunOpts): Promise<void> {
	const resp = await nc.request(
		SUBJECTS.runEnd,
		encode({
			runId,
			status: opts.status,
			costTokens: opts.costTokens,
			costComputeMs: opts.costComputeMs,
			costApiCalls: opts.costApiCalls,
			outputSummary: opts.outputSummary,
			agentTrace: opts.agentTrace,
			metadata: opts.metadata,
		}),
		{ timeout: 5000 }
	);
	const result = JSON.parse(decode(resp.data)) as { ok: boolean; error?: string };
	if (!result.ok) throw new Error(result.error ?? 'Failed to end run tracking');
}
