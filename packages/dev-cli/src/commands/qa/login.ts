import chalk from 'chalk';
import { Command } from 'commander';
import { ensureLoggedIn, resolveSession, resolveUrl } from './lib.js';

export const loginCommand = new Command('login')
	.description('Authenticate via HeadlessChrome bypass and persist session')
	.argument('[url]', 'Target URL')
	.option('--session <name>', 'Browser session name')
	.action(async (urlArg: string | undefined, opts: { session?: string }) => {
		const url = resolveUrl(urlArg);
		const session = resolveSession(opts.session);

		console.log(chalk.dim(`Logging in to ${url} (session: ${session})...`));

		ensureLoggedIn(url, session);

		console.log(chalk.green('\u2714 Logged in. Session persisted.'));
		console.log(chalk.dim('Subsequent QA commands will reuse this session.'));
	});
