'use client';

import { Button, Input, Spinner } from '@khal-os/ui';
import { Inbox } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useKhalAuth } from '@/lib/auth/use-auth';
import { useNats } from '@/lib/hooks/use-nats';
import { SUBJECTS } from '@/lib/subjects';
import type { LogEntry } from './types';

function buildQuickPickSubjects(orgId: string): string[] {
	return [SUBJECTS.echo(orgId), SUBJECTS.pty.create(orgId), SUBJECTS.pty.list(orgId)];
}

type RequestState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'success'; data: unknown }
	| { status: 'error'; message: string };

interface RequestPanelProps {
	/** Optional callback to push an entry to the message buffer. */
	onMessage?: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
}

export function RequestPanel({ onMessage }: RequestPanelProps) {
	const { connected, request } = useNats();
	const auth = useKhalAuth();
	const orgId = auth?.orgId ?? 'default';
	const quickPicks = useMemo(() => buildQuickPickSubjects(orgId), [orgId]);

	const [subject, setSubject] = useState('');
	const [payload, setPayload] = useState('');
	const [timeout, setTimeout_] = useState(5000);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [reqState, setReqState] = useState<RequestState>({ status: 'idle' });

	const handleSend = useCallback(async () => {
		setJsonError(null);

		let parsed: unknown;
		if (payload.trim()) {
			try {
				parsed = JSON.parse(payload);
			} catch (e) {
				setJsonError(`Invalid JSON: ${(e as Error).message}`);
				return;
			}
		}

		// Clear previous response and start loading
		setReqState({ status: 'loading' });

		// Push outgoing request to buffer
		onMessage?.({ subject, payload: parsed, direction: 'out' });

		try {
			const response = await request(subject, parsed, timeout);
			setReqState({ status: 'success', data: response });

			// Push response to buffer
			onMessage?.({ subject: `${subject} (reply)`, payload: response, direction: 'in' });
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setReqState({ status: 'error', message });
		}
	}, [subject, payload, timeout, request, onMessage]);

	const canSend = subject.trim().length > 0 && connected && reqState.status !== 'loading';

	return (
		<div className="flex flex-col gap-2">
			{/* Subject input */}
			<Input
				size="small"
				placeholder={SUBJECTS.echo(orgId)}
				value={subject}
				onChange={(e) => {
					setSubject(e.target.value);
					setJsonError(null);
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
				placeholder="{}"
				value={payload}
				onChange={(e) => {
					setPayload(e.target.value);
					setJsonError(null);
				}}
			/>

			{/* Timeout input */}
			<div className="flex items-center gap-2">
				<label className="text-[11px] text-gray-800 shrink-0">Timeout</label>
				<Input
					size="small"
					type="number"
					className="w-20 text-xs"
					value={timeout}
					onChange={(e) => setTimeout_(Number(e.target.value) || 5000)}
				/>
				<span className="text-[11px] text-gray-700">ms</span>
			</div>

			{/* JSON error */}
			{jsonError && <p className="text-[11px] text-red-600">{jsonError}</p>}

			{/* Send button */}
			<div className="flex items-center gap-2">
				<Button
					size="small"
					disabled={!canSend}
					onClick={handleSend}
					loading={reqState.status === 'loading'}
					prefix={<Inbox className="h-3 w-3" />}
				>
					Send Request
				</Button>
				{!connected && <span className="text-[11px] text-gray-600">Not connected</span>}
			</div>

			{/* Response area */}
			{reqState.status === 'loading' && (
				<div className="flex items-center gap-2 rounded border border-gray-alpha-300 bg-gray-alpha-50 px-2 py-2">
					<Spinner size="sm" />
					<span className="text-[11px] text-gray-800">Waiting for reply...</span>
				</div>
			)}

			{reqState.status === 'success' && (
				<div className="rounded border border-gray-alpha-400 bg-gray-alpha-50 p-2 overflow-auto max-h-48">
					<pre className="font-mono text-xs text-gray-1000 whitespace-pre-wrap break-all">
						{typeof reqState.data === 'string' ? reqState.data : JSON.stringify(reqState.data, null, 2)}
					</pre>
				</div>
			)}

			{reqState.status === 'error' && (
				<div className="rounded border border-red-300 bg-red-50 dark:bg-red-950/20 p-2">
					<p className="font-mono text-[11px] text-red-600 break-all">{reqState.message}</p>
				</div>
			)}
		</div>
	);
}
