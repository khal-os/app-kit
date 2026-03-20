'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNatsViewer } from './nats-viewer-context';

export function SubscribeInput() {
	const { addSubscription } = useNatsViewer();
	const [value, setValue] = useState('');
	const [error, setError] = useState('');

	const handleSubmit = () => {
		const trimmed = value.trim();
		if (!trimmed) return;

		if (!trimmed.startsWith('os.')) {
			setError('Subject must start with "os."');
			return;
		}

		setError('');
		addSubscription(trimmed);
		setValue('');
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-1">
				<input
					type="text"
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
						if (error) setError('');
					}}
					onKeyDown={handleKeyDown}
					placeholder="os.custom.subject"
					className="h-7 flex-1 rounded border border-gray-alpha-400 bg-background-100 px-2 font-mono text-xs text-gray-1000 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-700"
				/>
				<button
					onClick={handleSubmit}
					disabled={!value.trim()}
					className="flex h-7 shrink-0 items-center gap-1 rounded border border-gray-alpha-400 bg-background-100 px-2 text-xs text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000 disabled:opacity-40 disabled:pointer-events-none"
				>
					<Plus className="h-3 w-3" />
					Sub
				</button>
			</div>
			{error && <p className="px-0.5 text-[11px] text-red-600">{error}</p>}
		</div>
	);
}
