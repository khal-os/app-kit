import type { NatsConnection } from '@khal-os/sdk/service';
import { createService } from '@khal-os/sdk/service';
import { agentLifecycleHandlers } from './agent-lifecycle';
import { appsHandlers } from './apps';
import { commsHandlers } from './comms';
import { directorySubscriptions } from './directory';
import { systemSubscriptions } from './system';
import { taskHandlers } from './tasks';
import { teamsHandlers } from './teams';
import { createTerminalProxy } from './terminal-proxy';
import { TmuxControl } from './tmux-control';
import { wishHandlers } from './wishes';

let tmux: TmuxControl;
let nc: NatsConnection;
let termProxy: ReturnType<typeof createTerminalProxy>;

/**
 * Merge tmux pane data with genie agent registry for richer agent info.
 */
function loadAgentRegistry(): Record<string, { name: string; color: string; state: string; role: string }> {
	try {
		const fs = require('node:fs');
		const data = fs.readFileSync(`${process.env.HOME}/.genie/workers.json`, 'utf-8');
		const workers = JSON.parse(data);
		const map: Record<string, { name: string; color: string; state: string; role: string }> = {};
		for (const [id, worker] of Object.entries(workers as Record<string, Record<string, unknown>>)) {
			const paneId = worker.paneId as string | undefined;
			if (paneId) {
				map[paneId] = {
					name: (worker.name || worker.agentName || id) as string,
					color: (worker.nativeColor || worker.color || 'blue') as string,
					state: (worker.state || 'unknown') as string,
					role: (worker.role || worker.agentRole || '') as string,
				};
			}
		}
		return map;
	} catch {
		return {};
	}
}

createService({
	name: 'genie-control',
	onReady: (_nc: NatsConnection) => {
		nc = _nc;
		tmux = new TmuxControl();
		termProxy = createTerminalProxy(nc, tmux);

		// Event stream disabled — polling is sufficient for the dashboard refresh cycle
	},

	onShutdown: () => {
		termProxy?.shutdown();
	},

	subscriptions: [
		// --- List all agents ---
		{
			subject: 'os.genie.agents.list',
			handler: (msg) => {
				try {
					const sessions = tmux.listSessions();
					const windows = tmux.listWindows();
					const panes = tmux.listPanes();
					const registry = loadAgentRegistry();

					const tree = sessions.map((session) => ({
						...session,
						windows: windows
							.filter((w) => w.sessionId === session.id)
							.map((window) => ({
								...window,
								panes: panes
									.filter((p) => p.windowId === window.id)
									.map((pane) => ({ ...pane, agent: registry[pane.id] || null })),
							})),
					}));

					msg.respond(JSON.stringify({ sessions: tree, ts: Date.now() }));
				} catch (err) {
					msg.respond(JSON.stringify({ error: String(err), sessions: [] }));
				}
			},
		},

		// --- List sessions only ---
		{
			subject: 'os.genie.sessions.list',
			handler: (msg) => {
				try {
					msg.respond(JSON.stringify({ sessions: tmux.listSessions() }));
				} catch (err) {
					msg.respond(JSON.stringify({ error: String(err), sessions: [] }));
				}
			},
		},

		// --- Capture pane content ---
		{
			subject: 'os.genie.pane.*.capture',
			handler: (msg) => {
				const paneId = `%${msg.subject.split('.')[3]}`;
				try {
					let lines = 50;
					if (msg.data.length > 0) {
						const req = msg.json<{ lines?: number }>();
						if (req.lines) lines = req.lines;
					}
					msg.respond(JSON.stringify({ paneId, content: tmux.capturePane(paneId, lines) }));
				} catch (err) {
					msg.respond(JSON.stringify({ paneId, error: String(err), content: '' }));
				}
			},
		},

		// --- Send keys to pane ---
		{
			subject: 'os.genie.pane.*.send',
			handler: (msg) => {
				const paneId = `%${msg.subject.split('.')[3]}`;
				try {
					const req = msg.json<{ keys: string }>();
					tmux.sendKeys(paneId, req.keys);
					msg.respond(JSON.stringify({ ok: true }));
				} catch (err) {
					msg.respond(JSON.stringify({ ok: false, error: String(err) }));
				}
			},
		},

		// --- Spawn agent ---
		{
			subject: 'os.genie.spawn',
			handler: (msg) => {
				try {
					const { execSync } = require('node:child_process');
					const req = msg.json<{ role: string; team?: string; repo?: string }>();
					const args = [req.role];
					if (req.team) args.push('--team', req.team);
					const result = execSync(`genie spawn ${args.join(' ')}`, {
						cwd: req.repo || process.env.HOME,
						timeout: 15000,
						encoding: 'utf-8',
					});
					msg.respond(JSON.stringify({ ok: true, output: result.trim() }));
				} catch (err) {
					msg.respond(JSON.stringify({ ok: false, error: String(err) }));
				}
			},
		},

		// --- Terminal proxy: create PTY attached to tmux pane ---
		{
			subject: 'os.genie.term.create',
			handler: (msg) => {
				try {
					const req = msg.json<{ tmuxPaneId: string; cols?: number; rows?: number }>();
					const sessionId = termProxy.create(req.tmuxPaneId, req.cols, req.rows);
					msg.respond(JSON.stringify({ sessionId }));
				} catch (err) {
					msg.respond(JSON.stringify({ error: String(err) }));
				}
			},
		},

		// --- Terminal proxy: destroy ---
		{
			subject: 'os.genie.term.destroy',
			handler: (msg) => {
				try {
					const req = msg.json<{ sessionId: string }>();
					termProxy.destroy(req.sessionId);
					msg.respond(JSON.stringify({ ok: true }));
				} catch (err) {
					msg.respond(JSON.stringify({ ok: false, error: String(err) }));
				}
			},
		},

		// --- Terminal proxy: input (fire-and-forget) ---
		{
			subject: 'os.genie.term.*.input',
			handler: (msg) => {
				const sessionId = msg.subject.split('.')[3];
				if (msg.data.length > 0) {
					const parsed = msg.json<{ data: string }>();
					termProxy.write(sessionId, parsed.data);
				}
			},
		},

		// --- Terminal proxy: resize (fire-and-forget) ---
		{
			subject: 'os.genie.term.*.resize',
			handler: (msg) => {
				const sessionId = msg.subject.split('.')[3];
				const req = msg.json<{ cols: number; rows: number }>();
				termProxy.resize(sessionId, req.cols, req.rows);
			},
		},

		// --- Terminal proxy: replay buffer ---
		{
			subject: 'os.genie.term.*.replay',
			handler: (msg) => {
				const sessionId = msg.subject.split('.')[3];
				termProxy.replay(sessionId);
			},
		},

		// --- Domain modules ---
		...appsHandlers,
		...teamsHandlers,
		...agentLifecycleHandlers,
		...commsHandlers,
		...wishHandlers,
		...taskHandlers,
		...directorySubscriptions,
		...systemSubscriptions,
	],
});
