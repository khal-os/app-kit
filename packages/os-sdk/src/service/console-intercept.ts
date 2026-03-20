import type { Logger } from './logger';

interface OriginalConsole {
	log: typeof console.log;
	info: typeof console.info;
	warn: typeof console.warn;
	error: typeof console.error;
	debug: typeof console.debug;
}

let originals: OriginalConsole | null = null;

function formatArgs(args: unknown[]): string {
	return args
		.map((arg) => {
			if (typeof arg === 'string') return arg;
			if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ''}`;
			try {
				return JSON.stringify(arg);
			} catch {
				return String(arg);
			}
		})
		.join(' ');
}

export function interceptConsole(log: Logger): () => void {
	if (originals) {
		// Already intercepted — avoid double-wrapping
		return restoreConsole;
	}

	originals = {
		log: console.log,
		info: console.info,
		warn: console.warn,
		error: console.error,
		debug: console.debug,
	};

	console.log = (...args: unknown[]) => log.info(formatArgs(args));
	console.info = (...args: unknown[]) => log.info(formatArgs(args));
	console.warn = (...args: unknown[]) => log.warn(formatArgs(args));
	console.error = (...args: unknown[]) => log.error(formatArgs(args));
	console.debug = (...args: unknown[]) => log.debug(formatArgs(args));

	return restoreConsole;
}

export function restoreConsole(): void {
	if (!originals) return;

	console.log = originals.log;
	console.info = originals.info;
	console.warn = originals.warn;
	console.error = originals.error;
	console.debug = originals.debug;

	originals = null;
}
