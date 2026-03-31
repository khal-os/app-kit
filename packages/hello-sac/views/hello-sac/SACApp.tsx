'use client';

import { useNats } from '@khal-os/sdk/app';
import { EmptyState, SplitPane, StatusBar, Toolbar } from '@khal-os/ui';
import { Keyboard, Phone, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAgentConfig } from '../../lib/hooks/use-agent-config';
import { useCallState } from '../../lib/hooks/use-call-state';
import { useTranscript } from '../../lib/hooks/use-transcript';
import { DEFAULT_PRESETS } from '../../lib/presets';
import { AgentConfigSidebar } from './AgentConfigSidebar';
import { CallPanel } from './CallPanel';
import { ChatInput } from './ChatInput';
import { DTMFPad } from './DTMFPad';
import { TakeoverButton } from './TakeoverButton';
import { Transcript } from './Transcript';

interface SACAppProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function SACApp(_props: SACAppProps) {
	const { connected: natsConnected } = useNats();
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
	const [dtmfVisible, setDtmfVisible] = useState(true);
	const [callStartTime, setCallStartTime] = useState<number | null>(null);

	const {
		agents,
		selectedConfig,
		loading: agentsLoading,
		refresh: refreshAgents,
		fetchConfig,
		saveConfig,
	} = useAgentConfig();

	const { callState, reset: resetCallState } = useCallState(selectedAgentId);
	const { entries: transcriptEntries, clear: clearTranscript } = useTranscript(selectedAgentId);
	const containerRef = useRef<HTMLDivElement>(null);

	const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId), [agents, selectedAgentId]);

	const isCallActive =
		callState.status === 'connected' || callState.status === 'dialing' || callState.status === 'ringing';

	// Fetch agent config when selected
	useEffect(() => {
		if (selectedAgent) {
			fetchConfig(selectedAgent.slug);
		}
	}, [selectedAgent, fetchConfig]);

	// Track call start time for relative timestamps
	useEffect(() => {
		if (callState.status === 'connected' && !callStartTime) {
			setCallStartTime(Date.now());
		} else if (callState.status === 'idle' || callState.status === 'ended') {
			setCallStartTime(null);
		}
	}, [callState.status, callStartTime]);

	// Auto-select first agent if none selected and agents available
	useEffect(() => {
		if (!selectedAgentId && agents.length > 0) {
			setSelectedAgentId(agents[0].id);
		}
	}, [selectedAgentId, agents]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl+D toggle DTMF
			if (e.ctrlKey && e.key === 'd') {
				e.preventDefault();
				setDtmfVisible((prev) => !prev);
			}
			// Escape hangup (only outside inputs)
			if (e.key === 'Escape' && isCallActive) {
				const target = e.target as HTMLElement;
				if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
					// Hangup is handled by CallPanel button
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isCallActive]);

	const handleSelectAgent = useCallback(
		(agentId: string | null) => {
			setSelectedAgentId(agentId);
			clearTranscript();
			resetCallState();
		},
		[clearTranscript, resetCallState]
	);

	const toggleSidebar = useCallback(() => {
		setSidebarCollapsed((prev) => !prev);
	}, []);

	// Show first-launch create-agent prompt
	const showPresetPrompt = !agentsLoading && agents.length === 0 && DEFAULT_PRESETS.length > 0;

	if (!natsConnected) {
		return (
			<div className="flex h-full flex-col bg-background-100">
				<Toolbar>
					<Toolbar.Text>SAC Co-Pilot</Toolbar.Text>
					<Toolbar.Spacer />
				</Toolbar>
				<div className="flex flex-1 items-center justify-center p-4">
					<EmptyState
						icon={<Phone className="opacity-40" />}
						title="Connecting..."
						description="Waiting for NATS connection."
					/>
				</div>
				<StatusBar>
					<StatusBar.Item variant="error">Disconnected</StatusBar.Item>
					<StatusBar.Spacer />
				</StatusBar>
			</div>
		);
	}

	if (showPresetPrompt) {
		return (
			<div className="flex h-full flex-col bg-background-100">
				<Toolbar>
					<Toolbar.Text>SAC Co-Pilot</Toolbar.Text>
					<Toolbar.Spacer />
				</Toolbar>
				<div className="flex flex-1 items-center justify-center p-4">
					<EmptyState
						icon={<Phone className="opacity-40" />}
						title="No Agents Found"
						description="Create a default agent to get started. Open Agent Manager to configure your first voice agent."
					/>
				</div>
				<StatusBar>
					<StatusBar.Item variant="success">Connected</StatusBar.Item>
					<StatusBar.Spacer />
				</StatusBar>
			</div>
		);
	}

	return (
		<div ref={containerRef} className="flex h-full flex-col bg-background-100">
			{/* ── Toolbar ── */}
			<Toolbar>
				<Toolbar.Text>SAC Co-Pilot</Toolbar.Text>
				<Toolbar.Separator />
				{selectedAgent && (
					<Toolbar.Text>
						<span className="text-gray-400">{selectedAgent.name}</span>
					</Toolbar.Text>
				)}
				<Toolbar.Spacer />
				<Toolbar.Button tooltip="Toggle DTMF pad (Ctrl+D)" onClick={() => setDtmfVisible((prev) => !prev)}>
					<Keyboard />
				</Toolbar.Button>
				<Toolbar.Button tooltip="Agent config" onClick={toggleSidebar} active={!sidebarCollapsed}>
					<Settings />
				</Toolbar.Button>
			</Toolbar>

			{/* ── Main Content ── */}
			<div className="flex flex-1 overflow-hidden">
				<SplitPane direction="horizontal" defaultSize={32} min={25} max={42}>
					{/* Left Panel: Controls */}
					<SplitPane.Panel>
						<div className="flex h-full flex-col overflow-y-auto border-r border-white/5 scrollbar-thin">
							<CallPanel
								agents={agents}
								agentsLoading={agentsLoading}
								selectedAgentId={selectedAgentId}
								onSelectAgent={handleSelectAgent}
								callState={callState}
								onRefreshAgents={refreshAgents}
							/>

							<div className="border-t border-white/5" />

							{dtmfVisible && (
								<>
									<DTMFPad agentId={selectedAgentId} disabled={!isCallActive} />
									<div className="border-t border-white/5" />
								</>
							)}

							<ChatInput agentId={selectedAgentId} disabled={!isCallActive} />

							<div className="mt-auto border-t border-white/5">
								<TakeoverButton agentId={selectedAgentId} disabled={!isCallActive} />
							</div>
						</div>
					</SplitPane.Panel>

					{/* Right Panel: Transcript + Config Sidebar */}
					<SplitPane.Panel>
						<div className="flex h-full">
							<div className="flex-1 overflow-hidden">
								<Transcript entries={transcriptEntries} callStartTime={callStartTime} />
							</div>
							<AgentConfigSidebar
								config={selectedConfig}
								collapsed={sidebarCollapsed}
								onToggle={toggleSidebar}
								onSave={saveConfig}
							/>
						</div>
					</SplitPane.Panel>
				</SplitPane>
			</div>

			{/* ── Status Bar ── */}
			<StatusBar>
				<StatusBar.Item
					variant={natsConnected ? 'success' : 'error'}
					icon={
						<span
							className={`inline-block h-1.5 w-1.5 rounded-full ${natsConnected ? 'bg-green-500' : 'bg-red-500'}`}
						/>
					}
				>
					{natsConnected ? 'NATS' : 'Disconnected'}
				</StatusBar.Item>
				<StatusBar.Separator />
				{selectedAgent && (
					<>
						<StatusBar.Item>{selectedAgent.name}</StatusBar.Item>
						<StatusBar.Separator />
					</>
				)}
				{isCallActive && (
					<>
						<StatusBar.Item>{formatDuration(callState.duration)}</StatusBar.Item>
						<StatusBar.Separator />
					</>
				)}
				<StatusBar.Item>{callState.status.toUpperCase()}</StatusBar.Item>
				<StatusBar.Spacer />
				<StatusBar.Item>{transcriptEntries.length} entries</StatusBar.Item>
			</StatusBar>
		</div>
	);
}
