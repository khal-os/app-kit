'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SUBJECTS } from '../../../../lib/subjects';
import { useNatsAction } from '../hooks/useNatsAction';
import { useNatsRequest } from '../hooks/useNatsRequest';

// --- Types ---

interface ChatMessage {
	sender: string;
	timestamp: string;
	content: string;
}

interface ChatReadResponse {
	messages: ChatMessage[];
	error?: string;
}

interface InboxMessage {
	from: string;
	timestamp: string;
	body: string;
	read?: boolean;
}

interface InboxResponse {
	messages: InboxMessage[];
	error?: string;
}

// --- Sub-tabs ---

type ChatTab = 'chat' | 'inbox';

// --- Team Chat Tab ---

function TeamChatTab() {
	const { data, loading, error, refetch } = useNatsRequest<ChatReadResponse>(
		SUBJECTS.comms.chat.read(),
		undefined,
		5000
	);
	const postAction = useNatsAction(SUBJECTS.comms.chat.post());
	const [input, setInput] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const prevCountRef = useRef(0);

	const messages = data?.messages ?? [];

	// Auto-scroll when new messages arrive
	useEffect(() => {
		if (messages.length > prevCountRef.current) {
			messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
		}
		prevCountRef.current = messages.length;
	}, [messages.length]);

	const handleSend = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed || postAction.loading) return;
		setInput('');
		try {
			await postAction.execute({ message: trimmed });
			refetch();
		} catch {
			// error is surfaced via postAction.error
		}
	}, [input, postAction, refetch]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend]
	);

	if (loading && messages.length === 0) {
		return <LoadingState />;
	}

	if (error && messages.length === 0) {
		return <ErrorState message={error} onRetry={refetch} />;
	}

	return (
		<div className="flex h-full flex-col">
			{/* Messages */}
			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
				{messages.length === 0 ? (
					<EmptyState text="No messages yet" />
				) : (
					<div className="flex flex-col gap-2">
						{messages.map((msg, i) => (
							<div key={`${msg.timestamp}-${i}`} className="flex flex-col gap-0.5">
								<div className="flex items-baseline gap-1.5">
									<span className="text-[11px] font-medium text-[var(--os-text-primary)]">{msg.sender}</span>
									<span className="text-[9px] text-[var(--os-text-secondary)]">{formatTime(msg.timestamp)}</span>
								</div>
								<p className="text-[11px] leading-relaxed text-[var(--os-text-secondary)] break-words whitespace-pre-wrap">
									{msg.content}
								</p>
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			{/* Send input */}
			<div className="shrink-0 border-t border-white/10 p-2">
				{postAction.error && <p className="mb-1 text-[9px] text-red-400 truncate">{postAction.error}</p>}
				<div className="flex gap-1.5">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Send a message..."
						className="min-w-0 flex-1 rounded bg-white/5 px-2 py-1.5 text-[11px] text-[var(--os-text-primary)] placeholder:text-[var(--os-text-secondary)] outline-none focus:bg-white/10"
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!input.trim() || postAction.loading}
						className="shrink-0 rounded bg-white/10 px-2.5 py-1.5 text-[11px] text-[var(--os-text-primary)] hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}

// --- Inbox Tab ---

function InboxTab() {
	const [unreadOnly, setUnreadOnly] = useState(false);
	const payload = useMemo(() => (unreadOnly ? { unread: true } : {}), [unreadOnly]);
	const { data, loading, error, refetch } = useNatsRequest<InboxResponse>(SUBJECTS.comms.inbox(), payload, 5000);

	const messages = data?.messages ?? [];

	if (loading && messages.length === 0) {
		return <LoadingState />;
	}

	if (error && messages.length === 0) {
		return <ErrorState message={error} onRetry={refetch} />;
	}

	return (
		<div className="flex h-full flex-col">
			{/* Filter bar */}
			<div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-1.5">
				<button
					type="button"
					onClick={() => setUnreadOnly(false)}
					className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
						!unreadOnly
							? 'bg-white/15 text-[var(--os-text-primary)]'
							: 'text-[var(--os-text-secondary)] hover:text-[var(--os-text-primary)]'
					}`}
				>
					All
				</button>
				<button
					type="button"
					onClick={() => setUnreadOnly(true)}
					className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
						unreadOnly
							? 'bg-white/15 text-[var(--os-text-primary)]'
							: 'text-[var(--os-text-secondary)] hover:text-[var(--os-text-primary)]'
					}`}
				>
					Unread
				</button>
			</div>

			{/* Messages */}
			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
				{messages.length === 0 ? (
					<EmptyState text={unreadOnly ? 'No unread messages' : 'Inbox is empty'} />
				) : (
					<div className="flex flex-col gap-1.5">
						{messages.map((msg, i) => (
							<div
								key={`${msg.timestamp}-${i}`}
								className={`rounded px-2 py-1.5 ${msg.read === false ? 'bg-white/10' : 'bg-white/5'}`}
							>
								<div className="flex items-baseline gap-1.5">
									<span className="text-[11px] font-medium text-[var(--os-text-primary)]">{msg.from}</span>
									<span className="text-[9px] text-[var(--os-text-secondary)]">{formatTime(msg.timestamp)}</span>
									{msg.read === false && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />}
								</div>
								<p className="mt-0.5 text-[11px] leading-relaxed text-[var(--os-text-secondary)] break-words whitespace-pre-wrap">
									{msg.body}
								</p>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// --- Send Direct Message Section ---

function DirectMessageSection() {
	const sendAction = useNatsAction(SUBJECTS.comms.send());
	const [to, setTo] = useState('');
	const [body, setBody] = useState('');

	const handleSend = useCallback(async () => {
		const trimmedTo = to.trim();
		const trimmedBody = body.trim();
		if (!trimmedTo || !trimmedBody || sendAction.loading) return;
		try {
			await sendAction.execute({ to: trimmedTo, body: trimmedBody });
			setBody('');
		} catch {
			// error is surfaced via sendAction.error
		}
	}, [to, body, sendAction]);

	return (
		<div className="shrink-0 border-t border-white/10 px-3 py-2">
			<span className="text-[10px] font-medium text-[var(--os-text-secondary)]">Direct Message</span>
			{sendAction.error && <p className="mt-0.5 text-[9px] text-red-400 truncate">{sendAction.error}</p>}
			<div className="mt-1 flex flex-col gap-1.5">
				<input
					type="text"
					value={to}
					onChange={(e) => setTo(e.target.value)}
					placeholder="Recipient (agent name)"
					className="rounded bg-white/5 px-2 py-1 text-[11px] text-[var(--os-text-primary)] placeholder:text-[var(--os-text-secondary)] outline-none focus:bg-white/10"
				/>
				<div className="flex gap-1.5">
					<input
						type="text"
						value={body}
						onChange={(e) => setBody(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								handleSend();
							}
						}}
						placeholder="Message..."
						className="min-w-0 flex-1 rounded bg-white/5 px-2 py-1 text-[11px] text-[var(--os-text-primary)] placeholder:text-[var(--os-text-secondary)] outline-none focus:bg-white/10"
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!to.trim() || !body.trim() || sendAction.loading}
						className="shrink-0 rounded bg-white/10 px-2 py-1 text-[11px] text-[var(--os-text-primary)] hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}

// --- Shared utilities ---

function formatTime(ts: string): string {
	try {
		const date = new Date(ts);
		if (Number.isNaN(date.getTime())) return ts;
		return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	} catch {
		return ts;
	}
}

function LoadingState() {
	return (
		<div className="flex h-full items-center justify-center p-4">
			<p className="text-[11px] text-[var(--os-text-secondary)]">Loading...</p>
		</div>
	);
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 p-4">
			<p className="text-[11px] text-red-400 text-center">{message}</p>
			<button type="button" onClick={onRetry} className="rounded bg-white/10 px-2.5 py-1 text-[10px] hover:bg-white/20">
				Retry
			</button>
		</div>
	);
}

function EmptyState({ text }: { text: string }) {
	return (
		<div className="flex h-full items-center justify-center p-4">
			<p className="text-[11px] text-[var(--os-text-secondary)]">{text}</p>
		</div>
	);
}

// --- Main ChatPanel ---

export function ChatPanel() {
	const [activeTab, setActiveTab] = useState<ChatTab>('chat');

	return (
		<div className="flex h-full flex-col">
			{/* Tab bar */}
			<div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-3 py-1.5">
				<button
					type="button"
					onClick={() => setActiveTab('chat')}
					className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
						activeTab === 'chat'
							? 'bg-white/15 text-[var(--os-text-primary)]'
							: 'text-[var(--os-text-secondary)] hover:text-[var(--os-text-primary)]'
					}`}
				>
					Team Chat
				</button>
				<button
					type="button"
					onClick={() => setActiveTab('inbox')}
					className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
						activeTab === 'inbox'
							? 'bg-white/15 text-[var(--os-text-primary)]'
							: 'text-[var(--os-text-secondary)] hover:text-[var(--os-text-primary)]'
					}`}
				>
					Inbox
				</button>
			</div>

			{/* Tab content */}
			<div className="min-h-0 flex-1">{activeTab === 'chat' ? <TeamChatTab /> : <InboxTab />}</div>

			{/* Direct message — always visible */}
			<DirectMessageSection />
		</div>
	);
}
