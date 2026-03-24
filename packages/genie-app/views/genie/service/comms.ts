/**
 * Communication domain — inter-agent messaging and team chat.
 *
 * Endpoints:
 *   os.genie.comms.send      — send message to a specific agent
 *   os.genie.comms.broadcast  — broadcast message to all/team agents
 *   os.genie.comms.inbox      — read agent inbox
 *   os.genie.comms.chat.post  — post to team chat
 *   os.genie.comms.chat.read  — read team chat history
 */

import type { ServiceHandler } from '@khal-os/sdk/service';
import { SUBJECTS } from '../../../lib/subjects';
import { runGenie } from './cli';

export const commsHandlers: ServiceHandler[] = [
	// --- Send message to agent ---
	{
		subject: SUBJECTS.comms.send(),
		handler: (msg) => {
			try {
				const req = msg.json<{ body: string; to: string; from?: string }>();
				if (!req.body || !req.to) {
					msg.respond(JSON.stringify({ error: 'Missing required fields: body, to' }));
					return;
				}

				const args = ['send', req.body, '--to', req.to];
				if (req.from) args.push('--from', req.from);

				const result = runGenie(args, { json: false });
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

	// --- Broadcast message ---
	{
		subject: SUBJECTS.comms.broadcast(),
		handler: (msg) => {
			try {
				const req = msg.json<{ body: string; from?: string }>();
				if (!req.body) {
					msg.respond(JSON.stringify({ error: 'Missing required field: body' }));
					return;
				}

				const args = ['broadcast', req.body];
				if (req.from) args.push('--from', req.from);

				const result = runGenie(args, { json: false });
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

	// --- Read inbox ---
	{
		subject: SUBJECTS.comms.inbox(),
		handler: (msg) => {
			try {
				const req = msg.json<{ agent?: string; unread?: boolean }>();
				const args = ['inbox'];
				if (req.agent) args.push(req.agent);
				args.push('--json');
				if (req.unread) args.push('--unread');

				const result = runGenie<unknown[]>(args);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				const messages = Array.isArray(result.data) ? result.data : [];
				msg.respond(JSON.stringify({ messages }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Post to team chat ---
	{
		subject: SUBJECTS.comms.chat.post(),
		handler: (msg) => {
			try {
				const req = msg.json<{ message: string; team?: string }>();
				if (!req.message) {
					msg.respond(JSON.stringify({ error: 'Missing required field: message' }));
					return;
				}

				const args = ['chat', req.message];
				if (req.team) args.push('--team', req.team);

				const result = runGenie(args, { json: false });
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

	// --- Read team chat ---
	{
		subject: SUBJECTS.comms.chat.read(),
		handler: (msg) => {
			try {
				const req = msg.json<{ team?: string; since?: string }>();
				const args = ['chat', 'read', '--json'];
				if (req.team) args.push('--team', req.team);
				if (req.since) args.push('--since', req.since);

				const result = runGenie<unknown[]>(args);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				const messages = Array.isArray(result.data) ? result.data : [];
				msg.respond(JSON.stringify({ messages }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
];
