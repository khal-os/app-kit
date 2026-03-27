'use client';

import { Send, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNats } from '@/lib/hooks/use-nats';
import { cmd, INJECT_CONTEXT } from '../../lib/subjects';

interface ChatInputProps {
	agentId: string | null;
	disabled: boolean;
}

export function ChatInput({ agentId, disabled }: ChatInputProps) {
	const { publish } = useNats();
	const [text, setText] = useState('');
	const [recentInjections, setRecentInjections] = useState<{ id: number; text: string }[]>([]);
	const [nextId, setNextId] = useState(0);

	const handleSend = useCallback(() => {
		if (!agentId || !text.trim()) return;

		publish(cmd(agentId, INJECT_CONTEXT), {
			messages: [{ role: 'user', content: text.trim() }],
		});

		const id = nextId;
		setNextId((n) => n + 1);
		setRecentInjections((prev) => {
			const next = [{ id, text: text.trim() }, ...prev];
			return next.slice(0, 3);
		});
		setText('');
	}, [agentId, text, publish]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSend();
		}
	};

	const removeInjection = (id: number) => {
		setRecentInjections((prev) => prev.filter((item) => item.id !== id));
	};

	return (
		<div className="flex flex-col gap-2 p-3">
			{/* Recent injections */}
			{recentInjections.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{recentInjections.map((injection) => (
						<span
							key={injection.id}
							className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-400"
						>
							<span className="max-w-[120px] truncate">{injection.text}</span>
							<button type="button" onClick={() => removeInjection(injection.id)} className="hover:text-blue-200">
								<X className="h-2.5 w-2.5" />
							</button>
						</span>
					))}
				</div>
			)}

			{/* Input + Send */}
			<div className="flex gap-2">
				<Input
					placeholder="Type context to inject (e.g., CPF: 123.456.789-00)..."
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled || !agentId}
					className="flex-1 bg-background-200 text-sm"
				/>
				<Button
					size="small"
					className="gap-1.5 bg-blue-600 text-white hover:bg-blue-500"
					onClick={handleSend}
					disabled={disabled || !agentId || !text.trim()}
				>
					<Send className="h-3.5 w-3.5" />
					Inject
				</Button>
			</div>
			<span className="text-[10px] text-gray-600">Ctrl+Enter to send</span>
		</div>
	);
}
