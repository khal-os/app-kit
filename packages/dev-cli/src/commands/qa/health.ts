import chalk from 'chalk';
import { Command } from 'commander';
import type { HealthResponse } from '../../lib/types.js';
import { resolveUrl } from './lib.js';

interface ServerInfoResponse {
	version: string;
	capabilities: string[];
	[key: string]: unknown;
}

export const healthCommand = new Command('health')
	.description('Check /api/health and /api/server-info')
	.argument('[url]', 'Target URL')
	.option('--json', 'JSON output')
	.action(async (urlArg: string | undefined, opts: { json?: boolean }) => {
		const base = resolveUrl(urlArg);

		const [healthRes, infoRes] = await Promise.allSettled([
			fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) }),
			fetch(`${base}/api/server-info`, { signal: AbortSignal.timeout(5000) }),
		]);

		const health: HealthResponse | null =
			healthRes.status === 'fulfilled' && healthRes.value.ok
				? ((await healthRes.value.json()) as HealthResponse)
				: null;

		const info: ServerInfoResponse | null =
			infoRes.status === 'fulfilled' && infoRes.value.ok ? ((await infoRes.value.json()) as ServerInfoResponse) : null;

		const result = {
			healthy: health?.status === 'ok',
			status: health?.status ?? 'unreachable',
			version: health?.version ?? 'unknown',
			nats: health?.nats?.connected ?? false,
			uptime: health?.uptime ?? 0,
			capabilities: info?.capabilities ?? [],
		};

		if (opts.json) {
			console.log(JSON.stringify(result, null, 2));
			return;
		}

		const statusIcon = result.healthy ? chalk.green('\u2714') : chalk.red('\u2718');
		const natsIcon = result.nats ? chalk.green('\u2714') : chalk.red('\u2718');

		console.log(`\n${chalk.bold('QA Health')}\n`);
		console.log(`  ${statusIcon} Status: ${result.status}`);
		console.log(`  ${natsIcon} NATS: ${result.nats ? 'connected' : 'disconnected'}`);
		console.log(`  ${chalk.dim('Version:')} ${result.version}`);
		console.log(`  ${chalk.dim('Uptime:')}  ${result.uptime}s`);
		if (result.capabilities.length > 0) {
			console.log(`  ${chalk.dim('Capabilities:')} ${result.capabilities.join(', ')}`);
		}
		console.log('');

		if (!result.healthy) {
			process.exitCode = 1;
		}
	});
