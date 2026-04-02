/**
 * Board domain — board listing and detail via NATS.
 *
 * Endpoints:
 *   os.genie.board.list  — list all boards
 *   os.genie.board.show  — show board detail with columns
 */

import { SUBJECTS } from '../../../lib/subjects';
import type { GenieOutput } from './cli';
import { runGenie } from './cli';

interface NatsMsg {
	data: Uint8Array;
	json: <T>() => T;
	respond: (data: string) => void;
}

interface BoardListItem {
	id: string;
	name: string;
	description: string;
	status: string;
	columns: unknown[];
}

interface BoardDetail {
	id: string;
	name: string;
	description: string;
	status: string;
	columns: Array<{
		id: string;
		name: string;
		label: string;
		color: string;
		gate: string;
		action: string | null;
		position: number;
		roles: string[];
		auto_advance: boolean;
	}>;
	config: Record<string, unknown>;
}

export const boardHandlers = [
	{
		subject: SUBJECTS.board.list(),
		handler: (msg: NatsMsg) => {
			try {
				const result: GenieOutput<BoardListItem[]> = runGenie(['board', 'list', '--json']);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ boards: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	{
		subject: SUBJECTS.board.show(),
		handler: (msg: NatsMsg) => {
			try {
				const req = msg.json<{ name: string }>();
				if (!req.name) {
					msg.respond(JSON.stringify({ error: 'name is required' }));
					return;
				}

				const result: GenieOutput<BoardDetail> = runGenie(['board', 'show', req.name, '--json']);
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				msg.respond(JSON.stringify({ board: result.data }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
];
