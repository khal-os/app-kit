'use client';

import { useNats } from '@khal-os/sdk/app';
import { useState } from 'react';
import { SUBJECTS } from '../subjects';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export function {componentName}
({ windowId }
: AppComponentProps)
{
	const { request, connected, orgId } = useNats();
	const [response, setResponse] = useState<string>('');
	const [loading, setLoading] = useState(false);

	const handlePing = async () => {
		setLoading(true);
		try {
			const result = await request(SUBJECTS.ping(orgId), { message: 'hello from {{label}}' });
			setResponse(JSON.stringify(result, null, 2));
		} catch (err) {
			setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold">{{label}}</h1>
				<span className={`text-xs ${connected ? 'text-green-500' : 'text-red-500'}`}>
					{connected ? 'Connected' : 'Disconnected'}
				</span>
			</div>

			<p className="text-sm text-muted-foreground">{{description}}</p>

			<button
				type="button"
				onClick={handlePing}
				disabled={!connected || loading}
				className="w-fit px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
			>
				{loading ? 'Pinging...' : 'Ping Service'}
			</button>

			{response && (
				<pre className="p-3 rounded-md bg-muted text-sm font-mono overflow-auto max-h-60">
					{response}
				</pre>
			)}
		</div>
	);
}
