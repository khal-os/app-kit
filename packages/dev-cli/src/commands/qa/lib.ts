import { execSync } from 'node:child_process';

const DEFAULT_URL = 'http://localhost:8888';
const DEFAULT_SESSION = 'khal-qa';

/**
 * Resolve target URL: explicit arg > DEV_SLOT_URL env > default localhost.
 */
export function resolveUrl(urlArg?: string): string {
	if (urlArg) return urlArg;
	if (process.env.DEV_SLOT_URL) return process.env.DEV_SLOT_URL;
	return DEFAULT_URL;
}

/**
 * Resolve session name: explicit --session > GENIE_TEAM env > default.
 */
export function resolveSession(sessionArg?: string): string {
	if (sessionArg) return sessionArg;
	if (process.env.GENIE_TEAM) return `khal-qa-${process.env.GENIE_TEAM}`;
	return DEFAULT_SESSION;
}

/**
 * Execute an agent-browser command in the khal-qa session.
 * Returns stdout as a string. Throws on non-zero exit.
 */
export function execBrowser(cmd: string, session?: string): string {
	const s = resolveSession(session);
	const full = `agent-browser --session ${s} ${cmd}`;
	return execSync(full, { encoding: 'utf-8', timeout: 30_000 }).trim();
}

/**
 * Execute an agent-browser command and parse JSON output.
 */
export function execBrowserJson<T = unknown>(cmd: string, session?: string): T {
	const out = execBrowser(`${cmd} --json`, session);
	return JSON.parse(out) as T;
}

/**
 * Open a URL in the browser session, waiting for network idle.
 */
export function openAndWait(url: string, session?: string): void {
	execBrowser(
		`open "${url}" --user-agent "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36"`,
		session
	);
	execBrowser('wait --load networkidle', session);
}

/**
 * Ensure logged in: open with HeadlessChrome UA (triggers auth bypass), wait for desktop.
 */
export function ensureLoggedIn(url: string, session?: string): void {
	openAndWait(url, session);
}
