import chalk from 'chalk';
import { Command } from 'commander';
import { connectNats, decode, encode } from '../../lib/nats.js';
import { ensureLoggedIn, execBrowser, resolveSession, resolveUrl } from './lib.js';

interface AppListResponse {
	apps: Array<{ slug: string; store: { name: string; slug: string } | null }>;
}

export const assertAppsCommand = new Command('apps')
	.description('Compare NATS app count vs visible desktop icons')
	.argument('[url]', 'Target URL')
	.option('--session <name>', 'Browser session name')
	.option('--json', 'JSON output')
	.action(async (urlArg: string | undefined, opts: { session?: string; json?: boolean }) => {
		const url = resolveUrl(urlArg);
		const session = resolveSession(opts.session);

		// Ground truth: query NATS for installed apps
		let expectedApps: string[] = [];
		try {
			const nc = await connectNats();
			const resp = await nc.request('os.apps.list', encode({}), {
				timeout: 5000,
			});
			const data = JSON.parse(decode(resp.data)) as AppListResponse;
			expectedApps = data.apps.map((a) => a.store?.name ?? a.slug).filter(Boolean);
			await nc.close();
		} catch (_err) {
			console.error(chalk.red('Failed to query NATS for app list'));
			process.exitCode = 1;
			return;
		}

		// Reality: check desktop for visible app icons
		ensureLoggedIn(url, session);
		const snapshot = execBrowser('snapshot -i -c', session);

		// Parse snapshot for app-like elements (buttons, links with app names)
		const visibleNames: string[] = [];
		for (const line of snapshot.split('\n')) {
			// Look for interactive elements that could be app icons
			const nameMatch = line.match(/"([^"]+)"/);
			if (nameMatch) {
				visibleNames.push(nameMatch[1]);
			}
		}

		// Match expected vs visible
		const missing = expectedApps.filter(
			(name) => !visibleNames.some((v) => v.toLowerCase().includes(name.toLowerCase()))
		);
		const pass = missing.length === 0;

		const result = {
			pass,
			expected: expectedApps.length,
			visible: expectedApps.length - missing.length,
			missing,
			expectedApps,
		};

		if (opts.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			const icon = pass ? chalk.green('PASS') : chalk.red('FAIL');
			console.log(`${icon}: ${result.expected} apps expected, ${result.visible} visible`);
			if (missing.length > 0) {
				console.log(chalk.red(`  Missing: ${missing.join(', ')}`));
			}
		}

		if (!pass) process.exitCode = 1;
	});
