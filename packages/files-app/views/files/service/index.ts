import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NatsConnection } from '@khal-os/sdk/service';
import { createService } from '@khal-os/sdk/service';
import { getFilesRoot, resolveSafePath, validateFilename } from '../../../lib/safe-path';
import type { FileWriteRequest, FsListRequest, FsWatchEvent } from '../schema';

const MAX_ENTRIES = 500;

const ROOT = path.resolve(getFilesRoot());

/**
 * Compute a short hash for a directory path, used for watch subject routing.
 */
function pathHash(dirPath: string): string {
	return crypto.createHash('sha256').update(dirPath).digest('hex').slice(0, 12);
}

/**
 * Get the relative path from root, always starting with '/'.
 */
function relativePath(root: string, absPath: string): string {
	const rel = path.relative(root, absPath);
	if (rel === '') return '/';
	return `/${rel}`;
}

/**
 * Publish a watch event to the NATS subject for the given directory.
 */
function publishWatchEvent(nc: NatsConnection, dirAbsPath: string, event: FsWatchEvent) {
	const hash = pathHash(dirAbsPath);
	const subject = `os.fs.watch.${hash}`;
	nc.publish(subject, JSON.stringify(event));
	console.log(`[fs-service] watch event -> ${subject}:`, event);
}

function handleWriteOp(nc: NatsConnection, request: FileWriteRequest): { ok: boolean; error?: string } {
	switch (request.op) {
		case 'mkdir': {
			const safePath = resolveSafePath(ROOT, request.path);
			fs.mkdirSync(safePath, { recursive: true });
			console.log(`[fs-service] mkdir: ${safePath}`);

			const parentDir = path.dirname(safePath);
			publishWatchEvent(nc, parentDir, {
				type: 'create',
				path: relativePath(ROOT, safePath),
				name: path.basename(safePath),
			});
			return { ok: true };
		}

		case 'rename': {
			const nameError = validateFilename(request.newName);
			if (nameError) return { ok: false, error: nameError };

			const safePath = resolveSafePath(ROOT, request.path);
			const parentDir = path.dirname(safePath);
			const newPath = resolveSafePath(ROOT, path.join(relativePath(ROOT, parentDir), request.newName));

			fs.renameSync(safePath, newPath);
			console.log(`[fs-service] rename: ${safePath} -> ${newPath}`);

			publishWatchEvent(nc, parentDir, {
				type: 'rename',
				path: relativePath(ROOT, newPath),
				name: request.newName,
			});
			return { ok: true };
		}

		case 'move': {
			const safeSrc = resolveSafePath(ROOT, request.path);
			const safeDest = resolveSafePath(ROOT, request.dest);
			const targetPath = path.join(safeDest, path.basename(safeSrc));
			resolveSafePath(ROOT, relativePath(ROOT, targetPath));

			fs.renameSync(safeSrc, targetPath);
			console.log(`[fs-service] move: ${safeSrc} -> ${targetPath}`);

			const srcParent = path.dirname(safeSrc);
			publishWatchEvent(nc, srcParent, {
				type: 'delete',
				path: relativePath(ROOT, safeSrc),
				name: path.basename(safeSrc),
			});
			publishWatchEvent(nc, safeDest, {
				type: 'create',
				path: relativePath(ROOT, targetPath),
				name: path.basename(safeSrc),
			});
			return { ok: true };
		}

		case 'delete': {
			const safePath = resolveSafePath(ROOT, request.path);
			const parentDir = path.dirname(safePath);
			const entryName = path.basename(safePath);

			const stat = fs.statSync(safePath);
			if (stat.isDirectory()) {
				fs.rmSync(safePath, { recursive: true, force: true });
			} else {
				fs.unlinkSync(safePath);
			}
			console.log(`[fs-service] delete: ${safePath}`);

			publishWatchEvent(nc, parentDir, {
				type: 'delete',
				path: relativePath(ROOT, safePath),
				name: entryName,
			});
			return { ok: true };
		}

		default:
			return { ok: false, error: 'Unknown operation' };
	}
}

// Ensure root directory exists before starting.
fs.mkdirSync(ROOT, { recursive: true });
console.log(`[fs-service] root directory: ${ROOT}`);

createService({
	name: 'fs-service',
	subscriptions: [
		// --- os.fs.list (request-reply) ---
		{
			subject: 'khal.*.fs.list',
			handler: (msg) => {
				const request = msg.json<FsListRequest & { _authUserId?: string }>();
				const safePath = resolveSafePath(ROOT, request.path);

				const stat = fs.statSync(safePath);
				if (!stat.isDirectory()) {
					msg.respond(JSON.stringify({ error: 'Not a directory' }));
					return;
				}

				const dirents = fs.readdirSync(safePath, { withFileTypes: true });
				const entries = dirents.slice(0, MAX_ENTRIES).map((dirent) => {
					const fullPath = path.join(safePath, dirent.name);
					try {
						const entryStat = fs.statSync(fullPath);
						return {
							name: dirent.name,
							size: entryStat.size,
							mtime: entryStat.mtimeMs,
							isDir: dirent.isDirectory(),
						};
					} catch {
						// Entry may have been deleted between readdir and stat
						return {
							name: dirent.name,
							size: 0,
							mtime: 0,
							isDir: dirent.isDirectory(),
						};
					}
				});

				msg.respond(
					JSON.stringify({
						entries,
						path: relativePath(ROOT, safePath),
						root: ROOT,
					})
				);
			},
		},
		// --- os.fs.write (request-reply) ---
		{
			subject: 'khal.*.fs.write',
			handler: (msg, nc) => {
				const request = msg.json<FileWriteRequest & { _authUserId?: string }>();
				const result = handleWriteOp(nc, request);
				msg.respond(JSON.stringify(result));
			},
		},
	],
});
