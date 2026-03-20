/**
 * Wishes/Work domain — wish lifecycle and work orchestration via NATS.
 *
 * Endpoints:
 *   os.genie.wish.list    — list all wishes from .genie/wishes/ directories
 *   os.genie.wish.status  — parse `genie status <slug>` into structured groups
 *   os.genie.wish.work    — trigger `genie work <ref>` (async, spawns agents)
 *   os.genie.wish.done    — mark a wish/group done via `genie done <ref>`
 *   os.genie.wish.reset   — reset a wish/group via `genie reset <ref>`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SUBJECTS } from '../../../lib/subjects';
import { runGenie, runGenieAsync } from './cli';

/** Shape of a parsed execution group from `genie status` output */
interface WishGroup {
	group: number | string;
	status: string;
	assignee: string | null;
	started: string | null;
	completed: string | null;
}

/** Shape of a wish entry from directory scanning */
interface WishEntry {
	slug: string;
	status: string | null;
	date: string | null;
	summary: string | null;
}

/**
 * Parse `genie status <slug>` text output into structured data.
 *
 * Expected format:
 *   Wish: <slug>
 *   ──────────
 *     GROUP  STATUS        ASSIGNEE      STARTED        COMPLETED
 *     ─────────────────────────────────────────────────────────
 *     1      ✅ done        engineer      Mar 19, 16:16  Mar 19, 16:18
 *     2      🔄 in_progress engineer      Mar 19, 16:18  -
 *     ...
 *     Progress: 1/7 done | 5 in progress | 0 ready | 1 blocked
 */
function parseStatusOutput(text: string): { groups: WishGroup[]; summary: string } {
	const lines = text.split('\n');
	const groups: WishGroup[] = [];
	let summary = '';

	for (const line of lines) {
		// Match progress summary line
		if (line.trim().startsWith('Progress:')) {
			summary = line.trim();
			continue;
		}

		// Match group rows — they start with optional spaces, then a number or word like "review"
		// Pattern: group_id  status_emoji status_text  assignee  started  completed
		const groupMatch = line.match(
			/^\s+(\S+)\s+(?:[^\s]*\s+)?(done|in_progress|ready|blocked|pending|failed|review)\s+(\S+|-)\s+(.+)$/i
		);
		if (groupMatch) {
			const [, groupId, status, assignee, rest] = groupMatch;
			// Parse the dates — "started  completed" or "Mar 19, 16:16  Mar 19, 16:18" or "-  -"
			const dateParts = rest.trim().split(/\s{2,}/);
			const started = dateParts[0] === '-' ? null : dateParts[0] || null;
			const completed = dateParts[1] === '-' ? null : dateParts[1] || null;

			groups.push({
				group: /^\d+$/.test(groupId) ? Number.parseInt(groupId, 10) : groupId,
				status: status.toLowerCase(),
				assignee: assignee === '-' ? null : assignee,
				started,
				completed,
			});
		}
	}

	return { groups, summary };
}

/**
 * Parse WISH.md frontmatter to extract status, date, summary.
 */
function parseWishFrontmatter(content: string): { status: string | null; date: string | null; summary: string | null } {
	let status: string | null = null;
	let date: string | null = null;
	let summary: string | null = null;

	// Extract from markdown table format: | **Status** | DRAFT |
	const statusMatch = content.match(/\*\*Status\*\*\s*\|\s*(\S+)/);
	if (statusMatch) status = statusMatch[1];

	const dateMatch = content.match(/\*\*Date\*\*\s*\|\s*(\S+)/);
	if (dateMatch) date = dateMatch[1];

	// Summary is typically the first paragraph after ## Summary
	const summaryMatch = content.match(/## Summary\s*\n+(.+?)(?:\n\n|\n##)/s);
	if (summaryMatch) summary = summaryMatch[1].trim();

	return { status, date, summary };
}

/**
 * Find all .genie/wishes/ directories — check both the repo working directory and ~/.genie/wishes/.
 */
function findWishDirs(): string[] {
	const dirs: string[] = [];
	const homeWishes = join(process.env.HOME || '', '.genie', 'wishes');

	try {
		statSync(homeWishes);
		dirs.push(homeWishes);
	} catch {
		// doesn't exist
	}

	return dirs;
}

/**
 * List all wishes by scanning wish directories.
 */
function listWishes(): WishEntry[] {
	const wishes: WishEntry[] = [];
	const seen = new Set<string>();

	for (const wishDir of findWishDirs()) {
		try {
			const entries = readdirSync(wishDir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory() || seen.has(entry.name)) continue;
				seen.add(entry.name);

				const wishMdPath = join(wishDir, entry.name, 'WISH.md');
				try {
					const content = readFileSync(wishMdPath, 'utf-8');
					const frontmatter = parseWishFrontmatter(content);
					wishes.push({
						slug: entry.name,
						status: frontmatter.status,
						date: frontmatter.date,
						summary: frontmatter.summary,
					});
				} catch {
					// WISH.md doesn't exist or can't be read — still list the slug
					wishes.push({ slug: entry.name, status: null, date: null, summary: null });
				}
			}
		} catch {
			// directory doesn't exist or can't be read
		}
	}

	return wishes;
}

export const wishHandlers = [
	// --- List all wishes ---
	{
		subject: SUBJECTS.wish.list(),
		handler: (msg: { respond: (data: string) => void }) => {
			try {
				const wishes = listWishes();
				msg.respond(JSON.stringify({ wishes }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Get wish status ---
	{
		subject: SUBJECTS.wish.status(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const req = msg.json<{ slug: string }>();
				if (!req.slug) {
					msg.respond(JSON.stringify({ error: 'slug is required' }));
					return;
				}

				const result = runGenie(['status', req.slug], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}

				const parsed = parseStatusOutput(result.data as string);
				msg.respond(JSON.stringify(parsed));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- Trigger work execution (async — spawns agents) ---
	{
		subject: SUBJECTS.wish.work(),
		handler: async (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const req = msg.json<{ ref: string; agent?: string }>();
				if (!req.ref) {
					msg.respond(JSON.stringify({ error: 'ref is required' }));
					return;
				}

				const args = ['work', req.ref];
				if (req.agent) args.push(req.agent);

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

	// --- Mark wish/group as done ---
	{
		subject: SUBJECTS.wish.done(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const req = msg.json<{ ref: string }>();
				if (!req.ref) {
					msg.respond(JSON.stringify({ error: 'ref is required' }));
					return;
				}

				const result = runGenie(['done', req.ref], { json: false });
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

	// --- Reset wish/group ---
	{
		subject: SUBJECTS.wish.reset(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const req = msg.json<{ ref: string }>();
				if (!req.ref) {
					msg.respond(JSON.stringify({ error: 'ref is required' }));
					return;
				}

				const result = runGenie(['reset', req.ref], { json: false });
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
