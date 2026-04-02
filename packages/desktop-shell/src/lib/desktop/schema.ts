import { type Static, Type } from '@sinclair/typebox';

// -- Commands (inbound -- agents publish, browser executes) --

export const DesktopCmdOpen = Type.Object({
	appId: Type.String(),
	title: Type.Optional(Type.String()),
	meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
	width: Type.Optional(Type.Number()),
	height: Type.Optional(Type.Number()),
});
export type DesktopCmdOpen = Static<typeof DesktopCmdOpen>;

export const DesktopCmdWindow = Type.Object({
	windowId: Type.String(),
});
export type DesktopCmdWindow = Static<typeof DesktopCmdWindow>;

export const DesktopCmdNotify = Type.Object({
	summary: Type.String(),
	body: Type.Optional(Type.String()),
	appName: Type.Optional(Type.String()),
	urgency: Type.Optional(Type.Union([Type.Literal('low'), Type.Literal('normal'), Type.Literal('critical')])),
});
export type DesktopCmdNotify = Static<typeof DesktopCmdNotify>;

// -- Events (outbound -- browser publishes, agents observe) --

export const DesktopWindowEvent = Type.Object({
	windowId: Type.String(),
	appId: Type.String(),
	title: Type.String(),
	width: Type.Optional(Type.Number()),
	height: Type.Optional(Type.Number()),
	meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type DesktopWindowEvent = Static<typeof DesktopWindowEvent>;

export const DesktopWindowStateEntry = Type.Object({
	id: Type.String(),
	appId: Type.String(),
	title: Type.String(),
	minimized: Type.Boolean(),
	maximized: Type.Boolean(),
	focused: Type.Boolean(),
	position: Type.Optional(Type.Object({ x: Type.Number(), y: Type.Number() })),
	size: Type.Optional(Type.Object({ width: Type.Number(), height: Type.Number() })),
	zIndex: Type.Optional(Type.Number()),
	meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export const DesktopEventState = Type.Object({
	windows: Type.Array(DesktopWindowStateEntry),
});
export type DesktopEventState = Static<typeof DesktopEventState>;
