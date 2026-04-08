import chalk from 'chalk';
import { Command } from 'commander';
import { ensureLoggedIn, execBrowser, resolveSession, resolveUrl } from './lib.js';

export const consoleCommand = new Command('console')
	.description('Capture and categorize browser console messages')
	.argument('[url]', 'Target URL')
	.option('--session <name>', 'Browser session name')
	.option('--json', 'JSON output')
	.action(async (urlArg: string | undefined, opts: { session?: string; json?: boolean }) => {
		const url = resolveUrl(urlArg);
		const session = resolveSession(opts.session);

		ensureLoggedIn(url, session);

		const raw = execBrowser('console', session);
		const lines = raw.split('\n').filter(Boolean);

		const errors = lines.filter((l) => /\[error\]/i.test(l));
		const warnings = lines.filter((l) => /\[warn(ing)?\]/i.test(l));
		const info = lines.filter((l) => /\[info\]/i.test(l) || /\[log\]/i.test(l));
		const other = lines.filter(
			(l) => !/\[error\]/i.test(l) && !/\[warn(ing)?\]/i.test(l) && !/\[info\]/i.test(l) && !/\[log\]/i.test(l)
		);

		if (opts.json) {
			console.log(JSON.stringify({ errors, warnings, info, other, total: lines.length }, null, 2));
			return;
		}

		console.log(`\n${chalk.bold('QA Console')}\n`);
		console.log(`  Total: ${lines.length} messages`);
		console.log(`  ${chalk.red(`Errors: ${errors.length}`)}`);
		console.log(`  ${chalk.yellow(`Warnings: ${warnings.length}`)}`);
		console.log(`  ${chalk.dim(`Info: ${info.length}`)}`);
		console.log('');

		if (errors.length > 0) {
			console.log(chalk.red.bold('Errors:'));
			for (const e of errors) console.log(`  ${e}`);
			console.log('');
		}

		if (warnings.length > 0) {
			console.log(chalk.yellow.bold('Warnings:'));
			for (const w of warnings) console.log(`  ${w}`);
			console.log('');
		}
	});
