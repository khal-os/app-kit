import { mkdirSync } from 'node:fs';
import chalk from 'chalk';
import { Command } from 'commander';
import { ensureLoggedIn, execBrowser, resolveSession, resolveUrl } from './lib.js';

export const lookCommand = new Command('look')
	.description('Screenshot + DOM snapshot + console errors')
	.argument('[url]', 'Target URL')
	.option('--session <name>', 'Browser session name')
	.option('--full', 'Full page screenshot')
	.action(async (urlArg: string | undefined, opts: { session?: string; full?: boolean }) => {
		const url = resolveUrl(urlArg);
		const session = resolveSession(opts.session);

		ensureLoggedIn(url, session);

		// Screenshot
		const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const dir = '.qa/screenshots';
		mkdirSync(dir, { recursive: true });
		const screenshotPath = `${dir}/${ts}.png`;
		const screenshotFlags = opts.full ? '--full' : '';
		execBrowser(`screenshot ${screenshotPath} ${screenshotFlags}`.trim(), session);

		// DOM snapshot
		const snapshot = execBrowser('snapshot -c', session);
		const elementCount = (snapshot.match(/^\s*-/gm) || []).length;
		const interactiveCount = (snapshot.match(/\[ref=/g) || []).length;

		// Console errors
		const consoleOut = execBrowser('console', session);
		const errorCount = (consoleOut.match(/\[error\]/gi) || []).length;
		const warnCount = (consoleOut.match(/\[warn(ing)?\]/gi) || []).length;

		// Current URL
		const currentUrl = execBrowser('get url', session);

		console.log(`\n${chalk.bold('QA Look')}\n`);
		console.log(`  ${chalk.dim('URL:')}        ${currentUrl}`);
		console.log(`  ${chalk.dim('Screenshot:')} ${screenshotPath}`);
		console.log(`  ${chalk.dim('Console:')}    ${errorCount} errors, ${warnCount} warnings`);
		console.log(`  ${chalk.dim('DOM:')}        ${elementCount} elements, ${interactiveCount} interactive`);
		console.log('');

		if (errorCount > 0) {
			console.log(chalk.red('Console Errors:'));
			console.log(
				consoleOut
					.split('\n')
					.filter((l) => /\[error\]/i.test(l))
					.join('\n')
			);
			console.log('');
		}
	});
