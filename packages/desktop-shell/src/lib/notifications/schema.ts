import { type Static, Type } from '@sinclair/typebox';

export const NatsNotification = Type.Object({
	summary: Type.String(),
	body: Type.Optional(Type.String()),
	appName: Type.Optional(Type.String()),
	icon: Type.Optional(Type.String()),
	urgency: Type.Optional(Type.Union([Type.Literal('low'), Type.Literal('normal'), Type.Literal('critical')])),
	category: Type.Optional(Type.String()),
	transient: Type.Optional(Type.Boolean()),
});
export type NatsNotification = Static<typeof NatsNotification>;
