#!/usr/bin/env node
import { Command } from 'commander';
import { qaCommand } from './commands/qa.js';

const program = new Command()
	.name('khal-dev')
	.description('Khal OS developer CLI — scaffolding and QA tools')
	.version('1.0.0');

// ---- app create ----
const appCommand = new Command('app').description('App scaffolding tools');

appCommand
	.command('create')
	.argument('[name]', 'App name (kebab-case)')
	.description('Scaffold a new KhalOS app in the monorepo')
	.action(async (name?: string) => {
		const { runAppCreate } = await import('./commands/app-create.js');
		await runAppCreate(name);
	});

program.addCommand(appCommand);
program.addCommand(qaCommand);

program.parse();
