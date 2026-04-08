import { Command } from 'commander';
import { assertCommand } from './qa/assert.js';
import { bugCommand } from './qa/bug.js';
import { consoleCommand } from './qa/console.js';
import { healthCommand } from './qa/health.js';
import { loginCommand } from './qa/login.js';
import { lookCommand } from './qa/look.js';
import { sessionCommand } from './qa/session.js';

export const qaCommand = new Command('qa').description('QA tools — screenshot, assert, health check, bug report');

qaCommand.addCommand(lookCommand);
qaCommand.addCommand(healthCommand);
qaCommand.addCommand(consoleCommand);
qaCommand.addCommand(bugCommand);
qaCommand.addCommand(loginCommand);
qaCommand.addCommand(sessionCommand);
qaCommand.addCommand(assertCommand);
