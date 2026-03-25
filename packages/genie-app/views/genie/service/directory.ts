import { SUBJECTS } from '../../../lib/subjects';
import { runGenie } from './cli';

interface DirListPayload {
	builtins?: boolean;
}

interface DirGetPayload {
	name: string;
}

interface DirAddPayload {
	name: string;
	dir?: string;
	repo?: string;
	model?: string;
	promptMode?: string;
	roles?: string[];
	global?: boolean;
}

interface DirRemovePayload {
	name: string;
}

interface DirEditPayload {
	name: string;
	model?: string;
	dir?: string;
	repo?: string;
	promptMode?: string;
	roles?: string[];
	global?: boolean;
}

export const directorySubscriptions = [
	// --- List directory entries ---
	{
		subject: SUBJECTS.dir.list(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const payload = msg.data.length > 0 ? msg.json<DirListPayload>() : {};
				const args = ['dir', 'ls', '--json'];
				if (payload.builtins) args.push('--builtins');

				const result = runGenie(args);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ entries: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Get single directory entry ---
	{
		subject: SUBJECTS.dir.get(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const { name } = msg.json<DirGetPayload>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'name is required' }));
					return;
				}

				const result = runGenie(['dir', 'ls', name, '--json']);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ entry: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Add directory entry ---
	{
		subject: SUBJECTS.dir.add(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const { name, dir, repo, model, promptMode, roles, global: isGlobal } = msg.json<DirAddPayload>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'name is required' }));
					return;
				}

				const args = ['dir', 'add', name];
				if (dir) args.push('--dir', dir);
				if (repo) args.push('--repo', repo);
				if (model) args.push('--model', model);
				if (promptMode) args.push('--prompt-mode', promptMode);
				if (roles?.length) args.push('--roles', ...roles);
				if (isGlobal) args.push('--global');

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

	// --- Remove directory entry ---
	{
		subject: SUBJECTS.dir.remove(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const { name } = msg.json<DirRemovePayload>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'name is required' }));
					return;
				}

				const result = runGenie(['dir', 'rm', name], { json: false });
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

	// --- Edit directory entry ---
	{
		subject: SUBJECTS.dir.edit(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const { name, model, dir, repo, promptMode, roles, global: isGlobal } = msg.json<DirEditPayload>();
				if (!name) {
					msg.respond(JSON.stringify({ error: 'name is required' }));
					return;
				}

				const args = ['dir', 'edit', name];
				if (model) args.push('--model', model);
				if (dir) args.push('--dir', dir);
				if (repo) args.push('--repo', repo);
				if (promptMode) args.push('--prompt-mode', promptMode);
				if (roles?.length) args.push('--roles', ...roles);
				if (isGlobal) args.push('--global');

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
];
