'use client';

import { useMemo } from 'react';
import { useKhalAuth } from '@/lib/auth/use-auth';
import { useNats } from '@/lib/hooks/use-nats';
import { SUBJECTS } from '@/lib/subjects';
import { useNatsViewer } from './nats-viewer-context';

/**
 * Build a list of known static subjects.
 * Skips session-scoped subjects like pty.data.
 */
function buildKnownSubjects(orgId: string, userId: string): string[] {
	const subjects = [
		SUBJECTS.echo(orgId),
		SUBJECTS.system.health(orgId),
		SUBJECTS.pty.create(orgId),
		SUBJECTS.pty.destroy(orgId),
		SUBJECTS.pty.list(orgId),
		SUBJECTS.fs.list(orgId),
		SUBJECTS.fs.read(orgId),
		SUBJECTS.fs.write(orgId),
		SUBJECTS.fs.search(orgId),
		SUBJECTS.notify.broadcast(orgId),
	];
	if (userId) {
		subjects.push(SUBJECTS.desktop.cmd.all(orgId, userId), SUBJECTS.desktop.event.all(orgId, userId));
	}
	return subjects.sort();
}

export function SubjectCatalog() {
	const { subscriptions, addSubscription, removeSubscription } = useNatsViewer();
	const { userId } = useNats();
	const auth = useKhalAuth();
	const orgId = auth?.orgId ?? 'default';

	const knownSubjects = useMemo(() => buildKnownSubjects(orgId, userId), [orgId, userId]);

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
