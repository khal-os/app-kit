import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import { Command } from 'commander';
import type { HealthResponse } from '../../lib/types.js';
import { resolveUrl } from './lib.js';

export const assertHealthCommand = new Command('health')
	.description('Validate API health + NATS + version')
	.argument('[url]', 'Target URL')
	.option('--json', 'JSON output')
	.action(async (urlArg: string | undefined, opts: { json?: boolean }) => {
		const base = resolveUrl(urlArg);
		const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

		// Check /api/health
		let health: HealthResponse | null = null;
		try {
			const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
			if (res.ok) {
				health = (await res.json()) as HealthResponse;
				checks.push({
					name: 'health-endpoint',
					pass: health.status === 'ok',
					detail: `status=${health.status}`,
				});
			} else {
				checks.push({ name: 'health-endpoint', pass: false, detail: `HTTP ${res.status}` });
			}
		} catch {
			checks.push({ name: 'health-endpoint', pass: false, detail: 'unreachable' });
		}

		// Check NATS connected
		checks.push({
			name: 'nats-connected',
			pass: health?.nats?.connected === true,
			detail: health?.nats?.connected ? 'connected' : 'disconnected',
		});

		// Check version matches package.json
		let pkgVersion = 'unknown';
		try {
			const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
			pkgVersion = pkg.version;
		} catch {
			// If we can't read package.json, skip version check
		}
		const versionMatch = health?.version === pkgVersion;
		checks.push({
			name: 'version-match',
			pass: versionMatch || pkgVersion === 'unknown',
			detail: `api=${health?.version ?? 'unknown'} pkg=${pkgVersion}`,
		});

		// Check /api/server-info reachable
		try {
			const res = await fetch(`${base}/api/server-info`, { signal: AbortSignal.timeout(5000) });
			checks.push({
				name: 'server-info',
				pass: res.ok,
				detail: res.ok ? 'reachable' : `HTTP ${res.status}`,
			});
		} catch {
			checks.push({ name: 'server-info', pass: false, detail: 'unreachable' });
		}

		const allPass = checks.every((c) => c.pass);

		if (opts.json) {
			console.log(JSON.stringify({ pass: allPass, checks }, null, 2));
		} else {
			const icon = allPass ? chalk.green('PASS') : chalk.red('FAIL');
			const summary = [
				`health ${health?.status ?? 'down'}`,
				`NATS ${health?.nats?.connected ? 'connected' : 'disconnected'}`,
				`v${health?.version ?? '?'}`,
			].join(', ');
			console.log(`${icon}: ${summary}`);

			for (const c of checks) {
				const ci = c.pass ? chalk.green('\u2714') : chalk.red('\u2718');
				console.log(`  ${ci} ${c.name}: ${c.detail}`);
			}
		}

		if (!allPass) process.exitCode = 1;
	});
