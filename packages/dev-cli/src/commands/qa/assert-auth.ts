import chalk from 'chalk';
import { Command } from 'commander';
import { resolveUrl } from './lib.js';

export const assertAuthCommand = new Command('auth')
	.description('Test auth redirect + HeadlessChrome bypass')
	.argument('[url]', 'Target URL')
	.option('--json', 'JSON output')
	.action(async (urlArg: string | undefined, opts: { json?: boolean }) => {
		const base = resolveUrl(urlArg);
		const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

		// Test 1: Unauthenticated request should get redirected (307)
		try {
			const res = await fetch(base, {
				redirect: 'manual',
				signal: AbortSignal.timeout(5000),
			});
			const isRedirect = res.status === 307 || res.status === 302 || res.status === 301;
			checks.push({
				name: 'auth-redirect',
				pass: isRedirect,
				detail: `HTTP ${res.status}${isRedirect ? ' (redirect)' : ' (expected 307)'}`,
			});
		} catch (err) {
			checks.push({
				name: 'auth-redirect',
				pass: false,
				detail: `unreachable: ${err instanceof Error ? err.message : 'unknown'}`,
			});
		}

		// Test 2: HeadlessChrome UA on /desktop should bypass auth and return 200
		try {
			const res = await fetch(`${base}/desktop`, {
				redirect: 'follow',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
				},
				signal: AbortSignal.timeout(10000),
			});
			const isOk = res.status === 200;
			checks.push({
				name: 'headless-bypass',
				pass: isOk,
				detail: `HTTP ${res.status}${isOk ? ' (desktop rendered)' : ' (expected 200)'}`,
			});
		} catch (err) {
			checks.push({
				name: 'headless-bypass',
				pass: false,
				detail: `unreachable: ${err instanceof Error ? err.message : 'unknown'}`,
			});
		}

		const allPass = checks.every((c) => c.pass);

		if (opts.json) {
			console.log(JSON.stringify({ pass: allPass, checks }, null, 2));
		} else {
			const icon = allPass ? chalk.green('PASS') : chalk.red('FAIL');
			console.log(`${icon}: auth redirect works, headless bypass works`);

			for (const c of checks) {
				const ci = c.pass ? chalk.green('\u2714') : chalk.red('\u2718');
				console.log(`  ${ci} ${c.name}: ${c.detail}`);
			}
		}

		if (!allPass) process.exitCode = 1;
	});
