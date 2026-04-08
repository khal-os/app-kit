import chalk from 'chalk';
import { Command } from 'commander';
import { execBrowser, resolveSession } from './lib.js';

const listCommand = new Command('list').description('List active browser sessions').action(async () => {
	const out = execBrowser('session list', undefined);
	console.log(`\n${chalk.bold('Active Sessions')}\n`);
	console.log(out || chalk.dim('No active sessions'));
	console.log('');
});

const closeCommand = new Command('close')
	.description('Close the QA browser session')
	.option('--session <name>', 'Browser session name')
	.action(async (opts: { session?: string }) => {
		const session = resolveSession(opts.session);
		try {
			execBrowser('close', session);
			console.log(chalk.green(`\u2714 Session "${session}" closed.`));
		} catch {
			console.log(chalk.dim(`Session "${session}" was not active.`));
		}
	});

export const sessionCommand = new Command('session').description('Manage QA browser sessions');

sessionCommand.addCommand(listCommand);
sessionCommand.addCommand(closeCommand);
