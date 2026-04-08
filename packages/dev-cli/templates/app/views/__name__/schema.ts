import { type Static, Type } from '@sinclair/typebox';

// {{name}}.ping — example request-reply
export const PingRequest = Type.Object({
	message: Type.String(),
});
export type PingRequest = Static<typeof PingRequest>;

export const PingResponse = Type.Object({
	pong: Type.Boolean(),
	echo: Type.String(),
	timestamp: Type.Number(),
});
export type PingResponse = Static<typeof PingResponse>;
