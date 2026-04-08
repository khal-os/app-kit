import { Command } from 'commander';
import { assertAppsCommand } from './assert-apps.js';
import { assertAuthCommand } from './assert-auth.js';
import { assertHealthCommand } from './assert-health.js';

export const assertCommand = new Command('assert').description('Run QA assertions (ground truth vs reality)');

assertCommand.addCommand(assertAppsCommand);
assertCommand.addCommand(assertHealthCommand);
assertCommand.addCommand(assertAuthCommand);
