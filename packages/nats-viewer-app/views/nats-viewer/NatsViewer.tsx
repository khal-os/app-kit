'use client';

import { SectionHeader, SidebarNav, SplitPane, StatusBar, Toolbar } from '@khal-os/ui';
import { Filter, Inbox, Pause, Play, Radio, Send, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNats } from '@/lib/hooks/use-nats';
import { MessageLog } from './MessageLog';
import type { NatsViewerContextValue } from './nats-viewer-context';
import { NatsViewerContext } from './nats-viewer-context';
import { PublishPanel } from './PublishPanel';
import { RequestPanel } from './RequestPanel';
import { Sidebar } from './Sidebar';
import { useMessageBuffer } from './use-message-buffer';

export type { NatsViewerContextValue } from './nats-viewer-context';
export { useNatsViewer } from './nats-viewer-context';

// ---------------------------------------------------------------------------
// NatsViewer component
// ---------------------------------------------------------------------------

type SidebarSection = 'subjects' | 'publish' | 'request';

export function NatsViewer(_props: { windowId: string; meta?: Record<string, unknown> }) {
	const [activeSection, setActiveSection] = useState<SidebarSection>('subjects');
	const [paused, setPaused] = useState(false);
	const [filter, setFilter] = useState('');

	const { connected, subscribe } = useNats();
	const buffer = useMessageBuffer();

	// Track active subscriptions: subject -> unsub function
	const unsubMapRef = useRef<Map<string, () => void>>(new Map());
	const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

	// Stable ref for buffer.push so the subscribe callback never goes stale
	const pushRef = useRef(buffer.push);
	pushRef.current = buffer.push;

	const addSubscription = useCallback(
		(subject: string) => {
			if (unsubMapRef.current.has(subject)) return;

			const unsub = subscribe(subject, (data: unknown, actualSubject: string) => {
				pushRef.current({ subject: actualSubject, payload: data, direction: 'in' });
			});

			unsubMapRef.current.set(subject, unsub);
			setSubscriptions((prev) => new Set(prev).add(subject));
		},
		[subscribe]
	);

	const removeSubscription = useCallback((subject: string) => {
		const unsub = unsubMapRef.current.get(subject);
		if (unsub) {
			unsub();
			unsubMapRef.current.delete(subject);
		}
		setSubscriptions((prev) => {
			const next = new Set(prev);
			next.delete(subject);
			return next;
		});
	}, []);

	// Filtered count for toolbar display
	const filteredEntries = useMemo(() => {
		if (!filter) return buffer.entries;
		const lower = filter.toLowerCase();
		return buffer.entries.filter((e) => {
			if (e.subject.toLowerCase().includes(lower)) return true;
			try {
				return JSON.stringify(e.payload).toLowerCase().includes(lower);
			} catch {
				return false;
			}
		});
	}, [buffer.entries, filter]);

	const messageCountLabel = filter
		? `${filteredEntries.length}/${buffer.entries.length} messages`
		: `${buffer.entries.length} messages`;

	// Context value
	const ctxValue = useMemo<NatsViewerContextValue>(
		() => ({
			subscriptions,
			addSubscription,
			removeSubscription,
			buffer,
			filter,
			setFilter,
			paused,
			setPaused,
		}),
		[subscriptions, addSubscription, removeSubscription, buffer, filter, paused]
	);

	return (
		<NatsViewerContext.Provider value={ctxValue}>
			<div className="flex h-full flex-col bg-background-100">
				<div className="flex-1 overflow-hidden">
					<SplitPane defaultSize={250} min={180} max={360} collapseBelow={500}>
						{/* ---- Sidebar ---- */}
						<SplitPane.Panel className="bg-gray-alpha-50">
							<SidebarNav label="NATS Viewer" title="NATS Viewer">
								<SidebarNav.Group title="Subscriptions">
									<SidebarNav.Item
										active={activeSection === 'subjects'}
										onClick={() => setActiveSection('subjects')}
										icon={<Radio />}
									>
										Subjects
									</SidebarNav.Item>
								</SidebarNav.Group>

								<SidebarNav.Group title="Tools">
									<SidebarNav.Item
										active={activeSection === 'publish'}
										onClick={() => setActiveSection('publish')}
										icon={<Send />}
									>
										Publish
									</SidebarNav.Item>
									<SidebarNav.Item
										active={activeSection === 'request'}
										onClick={() => setActiveSection('request')}
										icon={<Inbox />}
									>
										Request
									</SidebarNav.Item>
								</SidebarNav.Group>
							</SidebarNav>

							{/* Sidebar detail panel */}
							<div className="flex-1 overflow-y-auto border-t border-gray-alpha-200 p-3">
								{activeSection === 'subjects' && <Sidebar />}
								{activeSection === 'publish' && (
									<div className="flex flex-col gap-2">
										<SectionHeader title="Publish" description="Send a message to a subject." />
										<PublishPanel onPublish={buffer.push} />
									</div>
								)}
								{activeSection === 'request' && (
									<div className="flex flex-col gap-2">
										<SectionHeader title="Request" description="Send a request and view the reply." />
										<RequestPanel onMessage={buffer.push} />
									</div>
								)}
							</div>
						</SplitPane.Panel>

						{/* ---- Main log area ---- */}
						<SplitPane.Panel>
							<div className="flex h-full flex-col">
								{/* Toolbar */}
								<Toolbar>
									<Toolbar.Group>
										<Toolbar.Button
											tooltip={paused ? 'Resume' : 'Pause'}
											onClick={() => setPaused(!paused)}
											active={paused}
										>
											{paused ? <Play /> : <Pause />}
										</Toolbar.Button>
										<Toolbar.Button tooltip="Clear log" onClick={() => buffer.clear()}>
											<Trash2 />
										</Toolbar.Button>
									</Toolbar.Group>
									<Toolbar.Separator />
									<Toolbar.Group>
										<Toolbar.Button tooltip="Filter">
											<Filter />
										</Toolbar.Button>
									</Toolbar.Group>
									<Toolbar.Input
										placeholder="Filter by subject or payload..."
										value={filter}
										onChange={(e) => setFilter(e.target.value)}
									/>
									<Toolbar.Spacer />
									<Toolbar.Text>{messageCountLabel}</Toolbar.Text>
								</Toolbar>

								{/* Message log */}
								<div className="flex-1 overflow-hidden">
									<MessageLog entries={buffer.entries} filter={filter} paused={paused} />
								</div>
							</div>
						</SplitPane.Panel>
					</SplitPane>
				</div>

				{/* Status bar */}
				<StatusBar>
					<StatusBar.Item>NATS Viewer</StatusBar.Item>
					<StatusBar.Separator />
					<StatusBar.Item>{subscriptions.size} subscription(s)</StatusBar.Item>
					<StatusBar.Spacer />
					<StatusBar.Item variant={connected ? 'success' : 'default'}>
						{connected ? 'connected' : 'disconnected'}
					</StatusBar.Item>
				</StatusBar>
			</div>
		</NatsViewerContext.Provider>
	);
}
