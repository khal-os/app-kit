/**
 * Tasks/Projects domain — task lifecycle and project listing via NATS.
 *
 * Endpoints:
 *   os.genie.task.list    — list tasks, optionally filtered by stage/project
 *   os.genie.task.show    — show full task detail by id or #seq
 *   os.genie.task.move    — move task to a new stage
 *   os.genie.task.create  — create a new task
 *   os.genie.task.done    — mark a task as done
 *   os.genie.project.list — list projects derived from task repo paths
 */

import { basename } from 'node:path';
import { SUBJECTS } from '../../../lib/subjects';
import type { GenieOutput } from './cli';
import { runGenie } from './cli';

/** Minimal msg shape used by all handlers. */
interface NatsMsg {
	data: Uint8Array;
	json: <T>() => T;
	respond: (data: string) => void;
}

/** A task record from `genie task list --json`. */
interface TaskRecord {
	id: string;
	seq: number;
	parentId: string | null;
	repoPath: string | null;
	title: string;
	description: string | null;
	typeId: string;
	stage: string;
	status: string;
	priority: string;
	groupName: string | null;
	startDate: string | null;
	dueDate: string | null;
	estimatedEffort: string | null;
	startedAt: string | null;
	endedAt: string | null;
	blockedReason: string | null;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export const taskHandlers = [
	// --- List tasks ---
	{
		subject: SUBJECTS.task.list(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.data.length > 0 ? msg.json<{ stage?: string; project?: string }>() : {};
				const args = ['task', 'list', '--json'];
				if (req.stage) args.push('--stage', req.stage);

				const result: GenieOutput<TaskRecord[]> = runGenie(args);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}

				let tasks = result.data as TaskRecord[];

				// Client-side project filter by repoPath basename
				if (req.project) {
					tasks = tasks.filter((t) => t.repoPath && basename(t.repoPath) === req.project);
				}

				msg.respond(JSON.stringify({ tasks }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Show task detail ---
	{
		subject: SUBJECTS.task.show(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ id: string }>();
				if (!req.id) {
					msg.respond(JSON.stringify({ error: 'id is required' }));
					return;
				}

				const result = runGenie(['task', 'show', req.id, '--json']);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}

				msg.respond(JSON.stringify({ task: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Move task to stage ---
	{
		subject: SUBJECTS.task.move(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ id: string; to: string; comment?: string }>();
				if (!req.id || !req.to) {
					msg.respond(JSON.stringify({ ok: false, error: 'id and to are required' }));
					return;
				}

				const args = ['task', 'move', req.id, '--to', req.to];
				if (req.comment) args.push('--comment', req.comment);

				const result = runGenie(args, { json: false });
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

	// --- Create task ---
	{
		subject: SUBJECTS.task.create(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{
					title: string;
					type?: string;
					priority?: string;
					description?: string;
					assign?: string;
				}>();
				if (!req.title) {
					msg.respond(JSON.stringify({ ok: false, error: 'title is required' }));
					return;
				}

				const args = ['task', 'create', req.title, '--type', req.type || 'software'];
				if (req.priority) args.push('--priority', req.priority);
				if (req.description) args.push('--description', req.description);
				if (req.assign) args.push('--assign', req.assign);

				const result = runGenie(args, { json: false });
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

	// --- Mark task done ---
	{
		subject: SUBJECTS.task.done(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ id: string; comment?: string }>();
				if (!req.id) {
					msg.respond(JSON.stringify({ ok: false, error: 'id is required' }));
					return;
				}

				const args = ['task', 'done', req.id];
				if (req.comment) args.push('--comment', req.comment);

				const result = runGenie(args, { json: false });
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

	// --- List projects (derived from task repo paths) ---
	{
		subject: SUBJECTS.project.list(),
		handler: (msg: NatsMsg) => {
			try {
				const result: GenieOutput<TaskRecord[]> = runGenie(['task', 'list', '--json']);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}

				const tasks = result.data as TaskRecord[];
				const projectMap = new Map<string, { name: string; path: string; taskCount: number }>();

				for (const task of tasks) {
					if (!task.repoPath) continue;
					const name = basename(task.repoPath);
					const existing = projectMap.get(name);
					if (existing) {
						existing.taskCount++;
					} else {
						projectMap.set(name, { name, path: task.repoPath, taskCount: 1 });
					}
				}

				const projects = Array.from(projectMap.values()).sort((a, b) =>
					a.name.localeCompare(b.name),
				);
				msg.respond(JSON.stringify({ projects }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
];
