import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { Command } from 'commander';
import { ensureLoggedIn, execBrowser, resolveSession, resolveUrl } from './lib.js';

export const bugCommand = new Command('bug')
	.description('Create a GitHub issue with screenshot + console + DOM evidence')
	.argument('<title>', 'Bug title')
	.argument('[url]', 'Target URL')
	.option('--session <name>', 'Browser session name')
	.option('--label <labels>', 'Additional labels (comma-separated)', '')
	.action(async (title: string, urlArg: string | undefined, opts: { session?: string; label?: string }) => {
		const url = resolveUrl(urlArg);
		const session = resolveSession(opts.session);

		console.log(chalk.dim('Capturing evidence...'));

		ensureLoggedIn(url, session);

		// Screenshot
		const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const dir = '.qa/screenshots';
		mkdirSync(dir, { recursive: true });
		const screenshotPath = `${dir}/bug-${ts}.png`;
		execBrowser(`screenshot ${screenshotPath} --full`, session);

		// Console errors
		const consoleOut = execBrowser('console', session);
		const errors = consoleOut
			.split('\n')
			.filter((l) => /\[error\]/i.test(l))
			.join('\n');

		// DOM snapshot
		const snapshot = execBrowser('snapshot -c -i', session);

		// Current URL
		const currentUrl = execBrowser('get url', session);

		// Write snapshot to file for reference
		const snapshotPath = `${dir}/bug-${ts}-snapshot.txt`;
		writeFileSync(snapshotPath, snapshot);

		// Build issue body
		const body = [
			'## Environment',
			`- **URL:** ${currentUrl}`,
			`- **Timestamp:** ${new Date().toISOString()}`,
			'',
			'## Console Errors',
			errors ? `\`\`\`\n${errors}\n\`\`\`` : '_No console errors_',
			'',
			'## DOM Snapshot (interactive elements)',
			`\`\`\`\n${snapshot.slice(0, 3000)}\n\`\`\``,
			'',
			'## Screenshot',
			`Saved to: \`${screenshotPath}\``,
		].join('\n');

		// Create GH issue
		const labels = ['bug', ...(opts.label ? opts.label.split(',') : [])].join(',');
		const ghCmd = `gh issue create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --label "${labels}"`;

		try {
			const issueUrl = execSync(ghCmd, { encoding: 'utf-8', timeout: 15_000 }).trim();
			console.log(`\n${chalk.green('\u2714')} Issue created: ${issueUrl}`);
			console.log(`  ${chalk.dim('Screenshot:')} ${screenshotPath}`);
			console.log(`  ${chalk.dim('Snapshot:')}   ${snapshotPath}`);
		} catch (_err) {
			console.error(chalk.red('Failed to create GitHub issue.'));
			console.error(chalk.dim('Body saved to:'), snapshotPath);
			writeFileSync(`${dir}/bug-${ts}-body.md`, body);
			process.exitCode = 1;
		}
	});
