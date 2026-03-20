'use client';

import { Send } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNats } from '@/lib/hooks/use-nats';
import { SUBJECTS } from '@/lib/subjects';
import type { LogEntry } from './types';

function buildQuickPickSubjects(): string[] {
	return [SUBJECTS.echo(), SUBJECTS.pty.create(), SUBJECTS.pty.list(), SUBJECTS.notify.broadcast()];
}

interface PublishPanelProps {
	/** Optional callback to push an entry to the message buffer. */
	onPublish?: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
}

export function PublishPanel({ onPublish }: PublishPanelProps) {
	const { connected, publish } = useNats();
	const quickPicks = useMemo(() => buildQuickPickSubjects(), []);

	const [subject, setSubject] = useState('');
	const [payload, setPayload] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);
	const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleSend = useCallback(() => {
		setError(null);

		let parsed: unknown;
		if (payload.trim()) {
			try {
				parsed = JSON.parse(payload);
			} catch (e) {
				setError(`Invalid JSON: ${(e as Error).message}`);
				return;
			}
		}

		publish(subject, parsed);

		// Push to buffer as outgoing message
		onPublish?.({ subject, payload: parsed, direction: 'out' });

		// Show "Sent!" indicator
		setSent(true);
		if (sentTimer.current) clearTimeout(sentTimer.current);
		sentTimer.current = setTimeout(() => setSent(false), 1000);
	}, [subject, payload, publish, onPublish]);

	const canSend = subject.trim().length > 0 && connected;

	return (
		<div className="flex flex-col gap-2">
			{/* Subject input */}
			<Input
				size="small"
				placeholder={SUBJECTS.echo()}
				value={subject}
				onChange={(e) => {
					setSubject(e.target.value);
					setError(null);
				}}
			/>

			{/* Quick-pick subjects */}
			<div className="flex flex-wrap gap-1">
				{quickPicks.map((s) => (
					<button
						key={s}
						type="button"
						className="rounded border border-gray-alpha-300 px-1.5 py-0.5 text-[10px] font-mono text-gray-800 hover:bg-gray-alpha-100 transition-colors"
						onClick={() => setSubject(s)}
					>
						{s}
					</button>
				))}
			</div>

			{/* Payload textarea */}
			<textarea
				className="w-full rounded-md border border-gray-alpha-400 bg-background-100 px-2 py-1.5 font-mono text-xs text-gray-1000 placeholder:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1 resize-none"
				rows={4}
				placeholder='{"key": "value"}'
				value={payload}
				onChange={(e) => {
					setPayload(e.target.value);
					setError(null);
				}}
			/>

			{/* Error message */}
			{error && <p className="text-[11px] text-red-600">{error}</p>}

			{/* Send button + Sent indicator */}
			<div className="flex items-center gap-2">
				<Button size="small" disabled={!canSend} onClick={handleSend} prefix={<Send className="h-3 w-3" />}>
					Send
				</Button>
				{sent && <span className="text-[11px] font-medium text-green-600 animate-pulse">Sent!</span>}
				{!connected && <span className="text-[11px] text-gray-600">Not connected</span>}
			</div>
		</div>
	);
}
