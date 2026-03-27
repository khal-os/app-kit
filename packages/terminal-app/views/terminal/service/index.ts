// Bail out early if node-pty is not available (e.g. binary mode without native addon)
try {
	require.resolve('node-pty');
} catch {
	console.warn('[terminal] node-pty not available — terminal service disabled');
	process.exit(0); // Graceful exit — service-loader won't retry
}

import type { NatsConnection } from '@khal-os/sdk/service';
import { createService } from '@khal-os/sdk/service';
import type {
	PtyCreateRequest,
	PtyDestroyRequest,
	PtyInputMessage,
	PtyListRequest,
	PtyReplayRequest,
	PtyResizeRequest,
} from '../schema';
import { createSessionManager } from './session';

// sessionManager is set in onReady before any messages can arrive.
let sessionManager: ReturnType<typeof createSessionManager>;

createService({
	name: 'pty-service',
	onReady: (nc: NatsConnection) => {
		const orgId = process.env.KHAL_INSTANCE_ID || 'default';
		sessionManager = createSessionManager(nc, orgId);
	},
	onShutdown: () => {
		sessionManager?.shutdown();
	},
	subscriptions: [
		// --- os.pty.create (request-reply) ---
		{
			subject: 'khal.*.pty.create',
			handler: async (msg) => {
				let request: PtyCreateRequest & { _authUserId?: string } = {};
				if (msg.data.length > 0) {
					request = msg.json<PtyCreateRequest & { _authUserId?: string }>();
				}
				const userId = request._authUserId || '';

				// If sessionId provided and session exists, reattach (no buffer replay yet -- client requests it after subscribing)
				if (request.sessionId && sessionManager.hasSession(request.sessionId)) {
					if (!userId || !sessionManager.isOwner(request.sessionId, userId)) {
						console.warn(
							`[pty-service] reattach denied: user ${userId || '<empty>'} does not own session ${request.sessionId}`
						);
						msg.respond(JSON.stringify({ error: 'ownership check failed' }));
						return;
					}
					console.log(`[pty-service] reattaching to existing session ${request.sessionId}`);
					msg.respond(
						JSON.stringify({
							sessionId: request.sessionId,
							created: false,
						})
					);
					return;
				}

				const response = sessionManager.createSession(request, userId);
				msg.respond(JSON.stringify(response));
			},
		},
		// --- os.pty.destroy (request-reply) ---
		{
			subject: 'khal.*.pty.destroy',
			handler: (msg) => {
				const request = msg.json<PtyDestroyRequest & { _authUserId?: string }>();
				const userId = request._authUserId;
				const destroyed = sessionManager.destroySession(request.sessionId, userId);
				if (!destroyed) {
					msg.respond(JSON.stringify({ ok: false, error: 'ownership check failed or session not found' }));
				} else {
					msg.respond(JSON.stringify({ ok: true }));
				}
			},
		},
		// --- os.pty.list (request-reply) ---
		{
			subject: 'khal.*.pty.list',
			handler: (msg) => {
				let listRequest: PtyListRequest & { _authUserId?: string } = {};
				if (msg.data.length > 0) {
					listRequest = msg.json<PtyListRequest & { _authUserId?: string }>();
				}
				const response = sessionManager.listSessions(listRequest._authUserId);
				msg.respond(JSON.stringify(response));
			},
		},
		// --- os.pty.*.input (wildcard sessionId, fire-and-forget) ---
		{
			subject: 'khal.*.pty.*.input',
			handler: (msg) => {
				const sessionId = msg.subject.split('.')[3];
				let data = '';
				let userId: string | undefined;

				if (msg.data.length > 0) {
					const parsed = msg.json<PtyInputMessage & { _authUserId?: string }>();
					data = parsed.data;
					userId = parsed._authUserId;
				}

				if (sessionId && data) {
					sessionManager.writeToSession(sessionId, data, userId);
				}
			},
		},
		// --- os.pty.*.resize (wildcard, fire-and-forget) ---
		{
			subject: 'khal.*.pty.*.resize',
			handler: (msg) => {
				const sessionId = msg.subject.split('.')[3];
				const request = msg.json<PtyResizeRequest & { _authUserId?: string }>();

				if (sessionId) {
					sessionManager.resizeSession(sessionId, request.cols, request.rows, request._authUserId);
				}
			},
		},
		// --- os.pty.*.replay (wildcard, fire-and-forget) ---
		// Client sends this AFTER subscribing to buffer/buffer-end subjects
		{
			subject: 'khal.*.pty.*.replay',
			handler: (msg) => {
				const sessionId = msg.subject.split('.')[3];
				let userId: string | undefined;
				if (msg.data.length > 0) {
					const request = msg.json<PtyReplayRequest & { _authUserId?: string }>();
					userId = request._authUserId;
				}
				if (sessionId) {
					console.log(`[pty-service] replaying buffer for session ${sessionId}`);
					sessionManager.replayBuffer(sessionId, userId);
				}
			},
		},
	],
});
