'use client';

import { useNats } from '@khal-os/sdk/app';
import { Headphones, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, SplitPane, StatusBar, Toolbar } from '@/components/os-primitives';
import { Note } from '@/components/ui/note';
import { AgentSelector } from './AgentSelector';
import { EventsPanel } from './EventsPanel';
import { useAgentList } from './hooks/useAgentList';
import { useAgentStream } from './hooks/useAgentStream';
import { InfoSidebar } from './InfoSidebar';
import { TranscriptPanel } from './TranscriptPanel';

interface ConsoleProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export function Console(_props: ConsoleProps) {
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
	const [subscribedAt, setSubscribedAt] = useState<Date | null>(null);
	const { connected: natsConnected } = useNats();

	const { agents, loading: agentsLoading, refresh: refreshAgents } = useAgentList();
	const stream = useAgentStream(selectedAgentId);

	const handleSelectAgent = useCallback((agentId: string | null) => {
		setSelectedAgentId(agentId);
		setSubscribedAt(agentId ? new Date() : null);
	}, []);

	const handleClear = useCallback(() => {
		stream.clearAll();
	}, [stream]);

	const selectedAgent = agents.find((a) => a.id === selectedAgentId);

	if (!natsConnected) {
		return (
			<div className="flex h-full flex-col bg-background-100">
				<Toolbar>
					<Toolbar.Text>Voice Console</Toolbar.Text>
					<Toolbar.Spacer />
				</Toolbar>
				<div className="flex flex-1 items-center justify-center p-4">
					<Note type="warning" label>
						NATS connection lost. Reconnecting...
					</Note>
				</div>
				<StatusBar>
					<StatusBar.Item variant="error">Disconnected</StatusBar.Item>
					<StatusBar.Spacer />
					<StatusBar.Item>Voice Console v1.0</StatusBar.Item>
				</StatusBar>
			</div>
		);
	}

	if (!selectedAgentId) {
		return (
			<div className="flex h-full flex-col bg-background-100">
				<Toolbar>
					<Toolbar.Text>Voice Console</Toolbar.Text>
					<Toolbar.Separator />
					<AgentSelector
						agents={agents}
						loading={agentsLoading}
						selectedId={selectedAgentId}
						onSelect={handleSelectAgent}
						onRefresh={refreshAgents}
					/>
					<Toolbar.Spacer />
				</Toolbar>
				<div className="flex flex-1 items-center justify-center overflow-hidden">
					<EmptyState
						icon={<Headphones />}
						title="Select an Agent"
						description="Choose a voice agent from the toolbar to begin monitoring its live activity."
					/>
				</div>
				<StatusBar>
					<StatusBar.Item>No agent selected</StatusBar.Item>
					<StatusBar.Spacer />
					<StatusBar.Item>Voice Console v1.0</StatusBar.Item>
				</StatusBar>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col bg-background-100">
			<Toolbar>
				<Toolbar.Text>Voice Console</Toolbar.Text>
				<Toolbar.Separator />
				<AgentSelector
					agents={agents}
					loading={agentsLoading}
					selectedId={selectedAgentId}
					onSelect={handleSelectAgent}
					onRefresh={refreshAgents}
				/>
				<Toolbar.Spacer />
				<Toolbar.Button tooltip="Clear all data" onClick={handleClear}>
					<Trash2 />
				</Toolbar.Button>
			</Toolbar>

			<div className="flex-1 overflow-hidden">
				<SplitPane direction="vertical" defaultSize={70} min={30} max={90}>
					<SplitPane.Panel>
						<SplitPane direction="horizontal" defaultSize={60} min={30} max={80}>
							<SplitPane.Panel>
								<TranscriptPanel transcript={stream.transcript} connected={stream.connected} />
							</SplitPane.Panel>
							<SplitPane.Panel>
								<InfoSidebar
									metrics={stream.metrics}
									speaking={stream.vadState.speaking}
									functionCalls={stream.functionCalls}
									connected={stream.connected}
								/>
							</SplitPane.Panel>
						</SplitPane>
					</SplitPane.Panel>
					<SplitPane.Panel>
						<EventsPanel events={stream.events} connected={stream.connected} />
					</SplitPane.Panel>
				</SplitPane>
			</div>

			<StatusBar>
				<StatusBar.Item
					variant={stream.connected ? 'success' : 'default'}
					icon={
						<span
							className={`inline-block h-1.5 w-1.5 rounded-full ${stream.connected ? 'bg-green-500' : 'bg-gray-400'}`}
						/>
					}
				>
					{selectedAgent?.name ?? selectedAgentId}
				</StatusBar.Item>
				<StatusBar.Separator />
				<StatusBar.Item>{stream.events.length} events</StatusBar.Item>
				<StatusBar.Separator />
				<DurationItem subscribedAt={subscribedAt} />
				<StatusBar.Spacer />
				<StatusBar.Item>Voice Console v1.0</StatusBar.Item>
			</StatusBar>
		</div>
	);
}

function DurationItem({ subscribedAt }: { subscribedAt: Date | null }) {
	const [elapsed, setElapsed] = useState('');

	useEffect(() => {
		if (!subscribedAt) {
			setElapsed('');
			return;
		}

		const tick = () => {
			const seconds = Math.floor((Date.now() - subscribedAt.getTime()) / 1000);
			const m = Math.floor(seconds / 60);
			const s = seconds % 60;
			setElapsed(`Connected ${m}m ${s.toString().padStart(2, '0')}s`);
		};

		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [subscribedAt]);

	if (!elapsed) return null;

	return <StatusBar.Item>{elapsed}</StatusBar.Item>;
}
