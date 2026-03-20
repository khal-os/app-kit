'use client';

import { useMemo } from 'react';
import { useNats } from '@/lib/hooks/use-nats';
import { SUBJECTS } from '@/lib/subjects';
import { useNatsViewer } from './nats-viewer-context';

/**
 * Build a list of known static subjects.
 * Skips session-scoped subjects like pty.data.
 */
function buildKnownSubjects(userId: string): string[] {
	const subjects = [
		SUBJECTS.echo(),
		SUBJECTS.system.health(),
		SUBJECTS.pty.create(),
		SUBJECTS.pty.destroy(),
		SUBJECTS.pty.list(),
		SUBJECTS.fs.list(),
		SUBJECTS.fs.read(),
		SUBJECTS.fs.write(),
		SUBJECTS.fs.search(),
		SUBJECTS.notify.broadcast(),
	];
	if (userId) {
		subjects.push(SUBJECTS.desktop.cmd.all(userId), SUBJECTS.desktop.event.all(userId));
	}
	return subjects.sort();
}

export function SubjectCatalog() {
	const { subscriptions, addSubscription, removeSubscription } = useNatsViewer();
	const { userId } = useNats();

	const knownSubjects = useMemo(() => buildKnownSubjects(userId), [userId]);

	return (
		<div className="flex flex-col gap-0.5">
			{knownSubjects.map((subject) => {
				const active = subscriptions.has(subject);
				return (
					<button
						key={subject}
						onClick={() => (active ? removeSubscription(subject) : addSubscription(subject))}
						className="group flex items-center gap-2 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-gray-alpha-100"
					>
						<span
							className={`inline-block h-2 w-2 shrink-0 rounded-full transition-colors ${
								active ? 'bg-green-500' : 'bg-gray-400 group-hover:bg-gray-500'
							}`}
						/>
						<span className="min-w-0 truncate font-mono text-xs text-gray-900 group-hover:text-gray-1000">
							{subject}
						</span>
					</button>
				);
			})}
		</div>
	);
}
