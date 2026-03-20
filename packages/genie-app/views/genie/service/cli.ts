/**
 * Shared CLI runner for the genie command.
 *
 * - `runGenie()` — synchronous, for fast commands (<1s): list, status, kill, etc.
 * - `runGenieAsync()` — promise-based, for long-running commands: team create, work, etc.
 *
 * Both use `execFileSync` / `execFile` with argument arrays to prevent command injection.
 */

import { execFile, execFileSync } from 'node:child_process';

export interface RunGenieOptions {
	/** Parse stdout as JSON. Defaults to true. */
	json?: boolean;
	/** Timeout in milliseconds. Defaults to 10_000. */
	timeout?: number;
	/** Working directory for the command. */
	cwd?: string;
}

export interface GenieResult<T = unknown> {
	ok: true;
	data: T;
}

export interface GenieError {
	ok: false;
	error: string;
}

export type GenieOutput<T = unknown> = GenieResult<T> | GenieError;

/**
 * Run a genie CLI command synchronously.
 *
 * Uses `execFileSync('genie', [...args])` — never string concatenation.
 *
 * @param args - Argument array passed directly to execFileSync (e.g. ['team', 'ls', '--json'])
 * @param opts - Options for JSON parsing, timeout, and cwd
 * @returns Parsed JSON when opts.json is true (default), raw string otherwise
 */
export function runGenie<_T = unknown>(args: string[], opts: RunGenieOptions & { json: false }): GenieOutput<string>;
export function runGenie<T = unknown>(args: string[], opts?: RunGenieOptions): GenieOutput<T>;
export function runGenie<T = unknown>(args: string[], opts?: RunGenieOptions): GenieOutput<T | string> {
	const { json = true, timeout = 10_000, cwd } = opts ?? {};

	try {
		const stdout = execFileSync('genie', args, {
			encoding: 'utf-8',
			timeout,
			cwd: cwd ?? process.env.HOME,
			env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
		}).trim();

		if (!json) {
			return { ok: true, data: stdout };
		}

		try {
			return { ok: true, data: JSON.parse(stdout) as T };
		} catch {
			// JSON parse failed — return raw text
			return { ok: true, data: stdout as unknown as T };
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: message };
	}
}

/**
 * Run a genie CLI command asynchronously (promise-based).
 *
 * Uses `execFile('genie', [...args])` — for long-running commands like `team create` or `work`.
 *
 * @param args - Argument array passed directly to execFile
 * @param opts - Options for JSON parsing, timeout, and cwd
 */
export function runGenieAsync<T = unknown>(args: string[], opts?: RunGenieOptions): Promise<GenieOutput<T | string>> {
	const { json = true, timeout = 60_000, cwd } = opts ?? {};

	return new Promise((resolve) => {
		execFile(
			'genie',
			args,
			{
				encoding: 'utf-8',
				timeout,
				cwd: cwd ?? process.env.HOME,
				env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
			},
			(err: Error | null, stdout: string, stderr: string) => {
				if (err) {
					const message = stderr?.trim() || err.message;
					resolve({ ok: false, error: message });
					return;
				}

				const output = stdout.trim();

				if (!json) {
					resolve({ ok: true, data: output });
					return;
				}

				try {
					resolve({ ok: true, data: JSON.parse(output) as T });
				} catch {
					resolve({ ok: true, data: output as unknown as T });
				}
			}
		);
	});
}
