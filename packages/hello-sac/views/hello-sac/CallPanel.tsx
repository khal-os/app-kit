'use client';

import { Phone, PhoneOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNats } from '@/lib/hooks/use-nats';
import { CALL_START } from '../../lib/subjects';
import type { AgentInfo, CallState } from '../../lib/types';

interface CallPanelProps {
	agents: AgentInfo[];
	agentsLoading: boolean;
	selectedAgentId: string | null;
	onSelectAgent: (agentId: string | null) => void;
	callState: CallState;
	onRefreshAgents: () => void;
}

const STATUS_VARIANT: Record<string, string> = {
	idle: 'bg-gray-500/20 text-gray-400',
	dialing: 'bg-amber-500/20 text-amber-400 animate-pulse',
	ringing: 'bg-blue-500/20 text-blue-400 animate-pulse',
	connected: 'bg-green-500/20 text-green-400',
	ended: 'bg-red-500/20 text-red-400',
};

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallPanel({
	agents,
	agentsLoading,
	selectedAgentId,
	onSelectAgent,
	callState,
	onRefreshAgents,
}: CallPanelProps) {
	const { publish } = useNats();
	const [targetNumber, setTargetNumber] = useState('');

	const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId), [agents, selectedAgentId]);

	// Pre-fill target number from agent config
	useEffect(() => {
		if (selectedAgent) {
			// Agent info doesn't carry targetNumber — leave empty for user input
			// unless overridden by config sidebar
		}
	}, [selectedAgent]);

	const isCallActive =
		callState.status === 'connected' || callState.status === 'dialing' || callState.status === 'ringing';

	const handleCall = useCallback(() => {
		if (!selectedAgentId || !targetNumber) return;
		publish(CALL_START, {
			agentId: selectedAgentId,
			phoneNumber: targetNumber,
		});
	}, [selectedAgentId, targetNumber, publish]);

	const handleHangup = useCallback(() => {
		if (!selectedAgentId) return;
		publish(`hello.${selectedAgentId}.cmd.end_call`, {});
	}, [selectedAgentId, publish]);

	return (
		<div className="flex flex-col gap-3 p-3">
			{/* Agent Selector */}
			<div className="flex flex-col gap-1.5">
				<label className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Agent</label>
				<select
					className="w-full rounded-md border border-white/10 bg-background-200 px-2.5 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
					value={selectedAgentId ?? ''}
					onChange={(e) => onSelectAgent(e.target.value || null)}
					disabled={agentsLoading || isCallActive}
				>
					<option value="">Select agent...</option>
					{agents.map((agent) => (
						<option key={agent.id} value={agent.id}>
							{agent.name} ({agent.status})
						</option>
					))}
				</select>
				<button
					type="button"
					className="self-end text-[10px] text-blue-400 hover:text-blue-300"
					onClick={onRefreshAgents}
				>
					Refresh
				</button>
			</div>

			{/* Target Number */}
			<div className="flex flex-col gap-1.5">
				<label className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Target Number</label>
				<Input
					type="tel"
					placeholder="+55 11 4004-3322"
					value={targetNumber}
					onChange={(e) => setTargetNumber(e.target.value)}
					disabled={isCallActive}
					className="bg-background-200 text-sm"
				/>
			</div>

			{/* Call / Hangup Buttons */}
			<div className="flex gap-2">
				{!isCallActive ? (
					<Button
						className="flex-1 gap-2 bg-green-600 text-white hover:bg-green-500"
						onClick={handleCall}
						disabled={!selectedAgentId || !targetNumber}
					>
						<Phone className="h-4 w-4" />
						Call
					</Button>
				) : (
					<Button className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-500" onClick={handleHangup}>
						<PhoneOff className="h-4 w-4" />
						Hangup
					</Button>
				)}
			</div>

			{/* Call State Badge */}
			<div className="flex items-center justify-between">
				<Badge className={`text-xs ${STATUS_VARIANT[callState.status] ?? STATUS_VARIANT.idle}`}>
					{callState.status.toUpperCase()}
				</Badge>
				{isCallActive && <span className="font-mono text-sm text-gray-300">{formatDuration(callState.duration)}</span>}
			</div>
		</div>
	);
}
