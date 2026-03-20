import { SUBJECTS } from '../../../lib/subjects';
import { runGenie } from './cli';

interface DoctorCheck {
	name: string;
	status: 'pass' | 'warn' | 'fail';
	detail: string;
}

interface DoctorResult {
	prerequisites: DoctorCheck[];
	configuration: DoctorCheck[];
	tmux: DoctorCheck[];
	workerProfiles: DoctorCheck[];
}

/**
 * Parse `genie doctor` text output into structured sections.
 *
 * The output uses ANSI-colored lines like:
 *   ✓ tmux                → pass
 *   ! Session 'genie'...  → warn
 *   ✗ something           → fail
 */
function parseDoctorOutput(text: string): DoctorResult {
	const result: DoctorResult = {
		prerequisites: [],
		configuration: [],
		tmux: [],
		workerProfiles: [],
	};

	// Strip ANSI escape codes
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes requires matching control characters
	const clean = text.replace(/\x1b\[[0-9;]*m/g, '');

	let currentSection: keyof DoctorResult | null = null;

	for (const line of clean.split('\n')) {
		const trimmed = line.trim();

		// Detect section headers
		if (/^prerequisites:/i.test(trimmed)) {
			currentSection = 'prerequisites';
			continue;
		}
		if (/^configuration:/i.test(trimmed)) {
			currentSection = 'configuration';
			continue;
		}
		if (/^tmux:/i.test(trimmed)) {
			currentSection = 'tmux';
			continue;
		}
		if (/^worker\s*profiles?:/i.test(trimmed)) {
			currentSection = 'workerProfiles';
			continue;
		}

		if (!currentSection) continue;

		// Parse check lines: ✓ / ! / ✗ followed by description
		let status: 'pass' | 'warn' | 'fail' | null = null;
		let detail = '';

		if (trimmed.startsWith('✓') || trimmed.startsWith('√')) {
			status = 'pass';
			detail = trimmed.slice(1).trim();
		} else if (trimmed.startsWith('!')) {
			status = 'warn';
			detail = trimmed.slice(1).trim();
		} else if (trimmed.startsWith('✗') || trimmed.startsWith('×') || trimmed.startsWith('x ')) {
			status = 'fail';
			detail = trimmed.slice(1).trim();
		}

		if (status && detail) {
			// Extract a short name from the first word(s) before any version/path info
			const name = detail.split(/\s+/)[0].toLowerCase();
			result[currentSection].push({ name, status, detail });
		}
	}

	return result;
}

export const systemSubscriptions = [
	// --- System doctor ---
	{
		subject: SUBJECTS.system.doctor(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const result = runGenie(['doctor'], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				const parsed = parseDoctorOutput(result.data as string);
				msg.respond(JSON.stringify(parsed));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},

	// --- System version ---
	{
		subject: SUBJECTS.system.version(),
		handler: (msg: { data: Uint8Array; json: <T>() => T; respond: (data: string) => void }) => {
			try {
				const result = runGenie(['--version'], { json: false });
				if (!result.ok) {
					msg.respond(JSON.stringify({ error: result.error }));
					return;
				}
				const version = (result.data as string).trim();
				msg.respond(JSON.stringify({ version }));
			} catch (err) {
				msg.respond(JSON.stringify({ error: String(err) }));
			}
		},
	},
];
