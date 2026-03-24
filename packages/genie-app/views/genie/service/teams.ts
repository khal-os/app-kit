/**
 * Teams domain — NATS handlers for team lifecycle management.
 *
 * Exports a ServiceHandler[] array to be spread into the main service subscriptions.
 */

import type { ServiceHandler } from '@khal-os/sdk/service';
import { SUBJECTS } from '../../../lib/subjects';
import { runGenie, runGenieAsync } from './cli';

// Use require() to avoid @types/node dependency (matches index.ts pattern)
const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');

const TEAMS_DIR = path.join(process.env.HOME ?? '', '.genie', 'teams');

export const teamsHandlers: ServiceHandler[] = [
	// --- List all teams ---
	{
		subject: SUBJECTS.teams.list(),
		handler: (msg) => {
			try {
				const result = runGenie<unknown[]>(['team', 'ls', '--json']);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error, teams: [] }));
					return;
				}
				msg.respond(JSON.stringify({ teams: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), teams: [] }));
			}
		},
	},

	// --- Get full team config ---
	{
		subject: SUBJECTS.teams.get(),
		handler: (msg) => {
			try {
				const req = msg.json<{ name: string }>();
				if (!req.name) {
					msg.respond(JSON.stringify({ error: 'Missing required field: name' }));
					return;
				}
				const teamFile = path.join(TEAMS_DIR, `${req.name}.json`);
				const raw = fs.readFileSync(teamFile, 'utf-8');
				const team = JSON.parse(raw);
				msg.respond(JSON.stringify({ team }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Create team (async — spawns worktree + team-lead) ---
	{
		subject: SUBJECTS.teams.create(),
		handler: async (msg) => {
			try {
				const req = msg.json<{ name: string; repo: string; branch?: string; wish?: string; session?: string }>();
				if (!req.name || !req.repo) {
					msg.respond(JSON.stringify({ ok: false, error: 'Missing required fields: name, repo' }));
					return;
				}

				const args = ['team', 'create', req.name, '--repo', req.repo];
				if (req.branch) args.push('--branch', req.branch);
				if (req.wish) args.push('--wish', req.wish);
				if (req.session) args.push('--session', req.session);

				const result = await runGenieAsync(args, { json: false, timeout: 120_000 });
				if (!result.ok) {
					msg.respond(JSON.stringify({ ok: false, error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true, output: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Disband team ---
	{
		subject: SUBJECTS.teams.disband(),
		handler: (msg) => {
			try {
				const req = msg.json<{ name: string }>();
				if (!req.name) {
					msg.respond(JSON.stringify({ ok: false, error: 'Missing required field: name' }));
					return;
				}
				const result = runGenie(['team', 'disband', req.name], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ ok: false, error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Mark team done ---
	{
		subject: SUBJECTS.teams.done(),
		handler: (msg) => {
			try {
				const req = msg.json<{ name: string }>();
				if (!req.name) {
					msg.respond(JSON.stringify({ ok: false, error: 'Missing required field: name' }));
					return;
				}
				const result = runGenie(['team', 'done', req.name], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ ok: false, error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Mark team blocked ---
	{
		subject: SUBJECTS.teams.blocked(),
		handler: (msg) => {
			try {
				const req = msg.json<{ name: string }>();
				if (!req.name) {
					msg.respond(JSON.stringify({ ok: false, error: 'Missing required field: name' }));
					return;
				}
				const result = runGenie(['team', 'blocked', req.name], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ ok: false, error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Hire agent into team ---
	{
		subject: SUBJECTS.teams.hire(),
		handler: (msg) => {
			try {
				const req = msg.json<{ agent: string; team: string }>();
				if (!req.agent || !req.team) {
					msg.respond(JSON.stringify({ ok: false, error: 'Missing required fields: agent, team' }));
					return;
				}
				const result = runGenie(['team', 'hire', req.agent, '--team', req.team], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ ok: false, error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true, output: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Fire agent from team ---
	{
		subject: SUBJECTS.teams.fire(),
		handler: (msg) => {
			try {
				const req = msg.json<{ agent: string; team: string }>();
				if (!req.agent || !req.team) {
					msg.respond(JSON.stringify({ ok: false, error: 'Missing required fields: agent, team' }));
					return;
				}
				const result = runGenie(['team', 'fire', req.agent, '--team', req.team], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ ok: false, error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true, output: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},
];
