import { type Static, Type } from '@sinclair/typebox';

// Note: userId is NOT included in request schemas.
// The WS bridge injects `_authUserId` from the authenticated session
// into all outbound NATS messages. Services read that field instead.

export const PtyCreateRequest = Type.Object({
	sessionId: Type.Optional(Type.String()),
	cols: Type.Optional(Type.Number()),
	rows: Type.Optional(Type.Number()),
});
export type PtyCreateRequest = Static<typeof PtyCreateRequest>;

export const PtyCreateResponse = Type.Object({
	sessionId: Type.String(),
	created: Type.Boolean(),
});
export type PtyCreateResponse = Static<typeof PtyCreateResponse>;

export const PtyListRequest = Type.Object({});
export type PtyListRequest = Static<typeof PtyListRequest>;

export const PtyDestroyRequest = Type.Object({
	sessionId: Type.String(),
});
export type PtyDestroyRequest = Static<typeof PtyDestroyRequest>;

export const PtyResizeRequest = Type.Object({
	sessionId: Type.String(),
	cols: Type.Number(),
	rows: Type.Number(),
});
export type PtyResizeRequest = Static<typeof PtyResizeRequest>;

export const PtyReplayRequest = Type.Object({
	sessionId: Type.String(),
});
export type PtyReplayRequest = Static<typeof PtyReplayRequest>;

export const PtyListResponse = Type.Object({
	sessions: Type.Array(
		Type.Object({
			sessionId: Type.String(),
			createdAt: Type.Number(),
			lastActivity: Type.Number(),
			bufferBytes: Type.Number(),
			connected: Type.Boolean(),
		})
	),
});
export type PtyListResponse = Static<typeof PtyListResponse>;

export const PtyDataMessage = Type.Object({
	sessionId: Type.String(),
	data: Type.String(), // base64 encoded
});
export type PtyDataMessage = Static<typeof PtyDataMessage>;

export const PtyInputMessage = Type.Object({
	sessionId: Type.String(),
	data: Type.String(), // raw text
});
export type PtyInputMessage = Static<typeof PtyInputMessage>;

export const PtyExitMessage = Type.Object({
	sessionId: Type.String(),
	code: Type.Number(),
	signal: Type.Optional(Type.Number()),
});
export type PtyExitMessage = Static<typeof PtyExitMessage>;

export const PtyBufferMessage = Type.Object({
	sessionId: Type.String(),
	data: Type.String(), // base64 encoded chunk
});
export type PtyBufferMessage = Static<typeof PtyBufferMessage>;

export const PtyBufferEndMessage = Type.Object({
	sessionId: Type.String(),
	error: Type.Optional(Type.String()),
});
export type PtyBufferEndMessage = Static<typeof PtyBufferEndMessage>;
