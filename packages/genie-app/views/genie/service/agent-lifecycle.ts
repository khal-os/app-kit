/**
 * Agent Lifecycle domain — kill, stop, history, answer, read.
 *
 * Exposes agent control operations beyond spawn (which lives in index.ts).
 */

import type { ServiceHandler } from '@khal-os/sdk/service';
import { SUBJECTS } from '../../../lib/subjects';
import { runGenie } from './cli';

export const agentLifecycleHandlers: ServiceHandler[] = [
	// --- Kill agent ---
	{
		subject: SUBJECTS.agent.kill(),
		handler: (msg) => {
			try {
				const { name } = msg.json<{ name: string }>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'Missing required field: name' }));
					return;
				}
				const result = runGenie(['kill', name], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Stop agent ---
	{
		subject: SUBJECTS.agent.stop(),
		handler: (msg) => {
			try {
				const { name } = msg.json<{ name: string }>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'Missing required field: name' }));
					return;
				}
				const result = runGenie(['stop', name], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Agent history ---
	{
		subject: SUBJECTS.agent.history(),
		handler: (msg) => {
			try {
				const { name, full, since } = msg.json<{ name: string; full?: boolean; since?: string }>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'Missing required field: name' }));
					return;
				}
				const args = ['history', name, '--json'];
				if (full) args.push('--full');
				if (since) args.push('--since', since);

				const result = runGenie<unknown[]>(args, { timeout: 15_000 });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ history: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Answer agent question ---
	{
		subject: SUBJECTS.agent.answer(),
		handler: (msg) => {
			try {
				const { name, choice } = msg.json<{ name: string; choice: string }>();
				if (!name || !choice) {
					msg.respond(JSON.stringify({ error: 'Missing required fields: name, choice' }));
					return;
				}
				// choice can be a number ("1") or text ("text:my answer")
				const result = runGenie(['answer', name, choice], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ ok: true, output: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Read agent output ---
	{
		subject: SUBJECTS.agent.read(),
		handler: (msg) => {
			try {
				const { name, lines, search, grep } = msg.json<{
					name: string;
					lines?: number;
					search?: string;
					grep?: string;
				}>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'Missing required field: name' }));
					return;
				}
				const args = ['read', name, '--json'];
				if (lines !== undefined) args.push('--lines', String(lines));
				if (search) args.push('--search', search);
				if (grep) args.push('--grep', grep);

				const result = runGenie(args, { timeout: 15_000 });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ output: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
];
