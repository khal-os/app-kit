import { type Static, Type } from '@sinclair/typebox';

// Note: userId is NOT included in request schemas.
// The WS bridge injects `_authUserId` from the authenticated session
// into all outbound NATS messages. Services read that field instead.

// fs.list
export const FsListRequest = Type.Object({
	path: Type.String(),
});
export type FsListRequest = Static<typeof FsListRequest>;

export const FileEntry = Type.Object({
	name: Type.String(),
	size: Type.Number(),
	mtime: Type.Number(), // epoch ms
	isDir: Type.Boolean(),
});
export type FileEntry = Static<typeof FileEntry>;

export const FileListResponse = Type.Object({
	entries: Type.Array(FileEntry),
	path: Type.String(), // resolved relative path
	root: Type.String(), // absolute filesystem root
});
export type FileListResponse = Static<typeof FileListResponse>;

// fs.write — multiplexed operations
export const FileWriteRequest = Type.Union([
	Type.Object({ op: Type.Literal('mkdir'), path: Type.String() }),
	Type.Object({ op: Type.Literal('rename'), path: Type.String(), newName: Type.String() }),
	Type.Object({ op: Type.Literal('move'), path: Type.String(), dest: Type.String() }),
	Type.Object({ op: Type.Literal('delete'), path: Type.String() }),
]);
export type FileWriteRequest = Static<typeof FileWriteRequest>;

export const FileWriteResponse = Type.Object({
	ok: Type.Boolean(),
	error: Type.Optional(Type.String()),
});
export type FileWriteResponse = Static<typeof FileWriteResponse>;

// fs.watch event
export const FsWatchEvent = Type.Object({
	type: Type.Union([Type.Literal('create'), Type.Literal('delete'), Type.Literal('rename'), Type.Literal('change')]),
	path: Type.String(),
	name: Type.String(),
});
export type FsWatchEvent = Static<typeof FsWatchEvent>;
