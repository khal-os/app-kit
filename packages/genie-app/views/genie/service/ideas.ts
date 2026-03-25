/**
 * Ideas domain — idea lifecycle via NATS.
 *
 * Ideas are genie tasks with `tag: idea` in `stage: draft`.
 * Votes stored in `tasks.metadata`. Promotion moves to `brainstorm` stage.
 *
 * Endpoints:
 *   os.genie.ideas.add     — create a new idea (task with idea tag)
 *   os.genie.ideas.list    — list idea-tagged tasks
 *   os.genie.ideas.vote    — upvote an idea (idempotent)
 *   os.genie.ideas.promote — move idea to brainstorm stage + scaffold DRAFT.md
 *   os.genie.ideas.archive — cancel an idea
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
	title: string;
	description: string | null;
	stage: string;
	status: string;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

/** Slugify a title for brainstorm directory naming. */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

/** Get all tasks, filter to idea-tagged ones. */
function listIdeaTasks(): TaskRecord[] {
	// List tasks with --tags doesn't exist, so list all and filter by metadata marker
	const result: GenieOutput<TaskRecord[]> = runGenie(['task', 'list', '--json', '--stage', 'draft']);
	if (!result.ok) return [];

	const allDrafts = result.data as TaskRecord[];
	// Also get brainstorm-stage ideas (promoted ones)
	const brainstormResult: GenieOutput<TaskRecord[]> = runGenie(['task', 'list', '--json', '--stage', 'brainstorm']);
	const brainstorms = brainstormResult.ok ? (brainstormResult.data as TaskRecord[]) : [];

	const all = [...allDrafts, ...brainstorms];
	return all.filter((t) => t.metadata && t.metadata.ideaTag === true);
}

export const ideasHandlers = [
	// --- Add idea ---
	{
		subject: SUBJECTS.ideas.add(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ title: string; description?: string; source?: string }>();
				if (!req.title) {
					msg.respond(JSON.stringify({ ok: false, error: 'title is required' }));
					return;
				}

				// Create task with stage: draft
				const args = ['task', 'create', req.title, '--type', 'software'];
				if (req.description) args.push('--description', req.description);

				const result = runGenie(args, { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ ok: false, error: result.error }));
					return;
				}

				// Extract task ID from output (format: "Created task task-<uuid> (#N)")
				const output = result.data as string;
				const idMatch = output.match(/task[-\s]([a-f0-9-]+)/i) || output.match(/#(\d+)/);
				const taskId = idMatch ? idMatch[0].replace('task ', 'task-').trim() : '';

				if (!taskId) {
					msg.respond(JSON.stringify({ ok: false, error: 'Failed to extract task ID from output', output }));
					return;
				}

				// Tag with 'idea'
				const tagResult = runGenie(['task', 'tag', taskId, 'idea'], { json: false });
				if (!tagResult.ok) {
					// Task was created but tagging failed — still return success with warning
					msg.respond(JSON.stringify({ ok: true, taskId, warning: 'Tag failed: ' + tagResult.error }));
					return;
				}

				// Store idea metadata via a comment (metadata not directly settable via CLI)
				// We use a convention: store idea metadata as a JSON comment
				const metadata = {
					ideaTag: true,
					source: req.source || 'user',
					votes: [] as string[],
					voteCount: 0,
				};
				runGenie(['task', 'comment', taskId, `__idea_meta__:${JSON.stringify(metadata)}`], { json: false });

				msg.respond(JSON.stringify({ ok: true, taskId }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- List ideas ---
	{
		subject: SUBJECTS.ideas.list(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.data.length > 0 ? msg.json<{ sort?: 'votes' | 'newest' | 'oldest'; status?: string }>() : {};

				const ideas = listIdeaTasks();

				// Map to response format
				let mapped = ideas.map((t) => ({
					id: t.id,
					title: t.title,
					description: t.description,
					voteCount: (t.metadata?.voteCount as number) || 0,
					votes: (t.metadata?.votes as string[]) || [],
					status: t.status,
					stage: t.stage,
					source: (t.metadata?.source as string) || 'user',
					promotedToSlug: (t.metadata?.promotedToSlug as string) || null,
					createdAt: t.createdAt,
				}));

				// Filter by status if specified
				if (req.status) {
					mapped = mapped.filter((i) => i.status === req.status || i.stage === req.status);
				}

				// Sort
				const sort = req.sort || 'newest';
				if (sort === 'votes') {
					mapped.sort((a, b) => b.voteCount - a.voteCount);
				} else if (sort === 'oldest') {
					mapped.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
				} else {
					// newest (default)
					mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				}

				msg.respond(JSON.stringify({ ideas: mapped }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err), ideas: [] }));
			}
		},
	},

	// --- Vote for idea ---
	{
		subject: SUBJECTS.ideas.vote(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ taskId: string; userId: string }>();
				if (!req.taskId || !req.userId) {
					msg.respond(JSON.stringify({ ok: false, error: 'taskId and userId are required' }));
					return;
				}

				// Get current task to read metadata
				const showResult = runGenie(['task', 'show', req.taskId, '--json']);
				if (!showResult.ok) {
					msg.respond(JSON.stringify({ ok: false, error: showResult.error }));
					return;
				}

				const task = showResult.data as TaskRecord;
				const votes = (task.metadata?.votes as string[]) || [];

				// Idempotent: if already voted, return current count
				if (votes.includes(req.userId)) {
					msg.respond(JSON.stringify({ ok: true, voteCount: votes.length, alreadyVoted: true }));
					return;
				}

				// Add vote
				const newVotes = [...votes, req.userId];
				const newMeta = {
					...task.metadata,
					ideaTag: true,
					votes: newVotes,
					voteCount: newVotes.length,
				};

				// Update via comment (metadata update convention)
				runGenie(['task', 'comment', req.taskId, `__idea_meta__:${JSON.stringify(newMeta)}`], { json: false });

				msg.respond(JSON.stringify({ ok: true, voteCount: newVotes.length }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Promote idea to brainstorm ---
	{
		subject: SUBJECTS.ideas.promote(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ taskId: string }>();
				if (!req.taskId) {
					msg.respond(JSON.stringify({ ok: false, error: 'taskId is required' }));
					return;
				}

				// Get task details
				const showResult = runGenie(['task', 'show', req.taskId, '--json']);
				if (!showResult.ok) {
					msg.respond(JSON.stringify({ ok: false, error: showResult.error }));
					return;
				}

				const task = showResult.data as TaskRecord;
				const slug = slugify(task.title);

				// Move to brainstorm stage
				const moveResult = runGenie(
					['task', 'move', req.taskId, '--to', 'brainstorm', '--comment', 'Promoted from idea pool'],
					{ json: false }
				);
				if (!moveResult.ok) {
					msg.respond(JSON.stringify({ ok: false, error: moveResult.error }));
					return;
				}

				// Create DRAFT.md scaffold
				const brainstormDir = join(process.env.HOME || '/tmp', '.genie', 'brainstorms', slug);

				if (!existsSync(brainstormDir)) {
					mkdirSync(brainstormDir, { recursive: true });
				}

				const draftPath = join(brainstormDir, 'DRAFT.md');
				const draftContent = `# Brainstorm: ${task.title}

## Origin
Promoted from idea #${req.taskId}

## Problem
${task.description || 'To be defined'}

## Notes
- Promoted on ${new Date().toISOString().split('T')[0]}
`;

				writeFileSync(draftPath, draftContent, 'utf-8');

				// Update metadata with promotion info
				const newMeta = {
					...task.metadata,
					ideaTag: true,
					promotedToSlug: slug,
				};
				runGenie(['task', 'comment', req.taskId, `__idea_meta__:${JSON.stringify(newMeta)}`], { json: false });

				msg.respond(JSON.stringify({ ok: true, slug, draftPath }));
			} catch (err) {
				msg.respond(JSON.stringify({ ok: false, error: String(err) }));
			}
		},
	},

	// --- Archive idea ---
	{
		subject: SUBJECTS.ideas.archive(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ taskId: string }>();
				if (!req.taskId) {
					msg.respond(JSON.stringify({ ok: false, error: 'taskId is required' }));
					return;
				}

				const result = runGenie(['task', 'done', req.taskId, '--comment', 'Archived from idea pool'], { json: false });
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
];
