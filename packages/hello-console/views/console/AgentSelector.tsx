'use client';

import { Badge, Button, Spinner } from '@khal-os/ui';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { AgentInfo } from './types';

interface AgentSelectorProps {
	agents: AgentInfo[];
	loading: boolean;
	selectedId: string | null;
	onSelect: (agentId: string | null) => void;
	onRefresh: () => void;
}

export function AgentSelector({ agents, loading, selectedId, onSelect, onRefresh }: AgentSelectorProps) {
	const [open, setOpen] = useState(false);

	const selectedAgent = agents.find((a) => a.id === selectedId);

	return (
		<div className="relative flex items-center gap-1.5">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex h-6 items-center gap-1.5 rounded-sm border border-gray-alpha-200 bg-background-200 px-2 text-copy-13 text-gray-1000 hover:bg-gray-alpha-100"
			>
				{selectedAgent ? (
					<>
						<span
							className={`inline-block h-1.5 w-1.5 rounded-full ${selectedAgent.status === 'running' ? 'bg-green-500' : 'bg-gray-400'}`}
						/>
						<span className="max-w-[160px] truncate">{selectedAgent.name}</span>
					</>
				) : (
					<span className="text-gray-600">Select an agent...</span>
				)}
				<svg className="h-3 w-3 text-gray-500" viewBox="0 0 12 12" fill="none">
					<path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</button>

			{loading && <Spinner size="sm" />}

			<Button variant="ghost" size="icon" onClick={onRefresh} className="h-6 w-6">
				<RefreshCw className="h-3 w-3" />
			</Button>

			{open && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} onKeyDown={() => {}} />
					<div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-gray-alpha-200 bg-background-100 py-1 shadow-lg">
						{agents.length === 0 ? (
							<div className="px-3 py-2 text-copy-13 text-gray-500">No agents found</div>
						) : (
							agents.map((agent) => (
								<button
									key={agent.id}
									type="button"
									onClick={() => {
										onSelect(agent.id);
										setOpen(false);
									}}
									className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-copy-13 hover:bg-gray-alpha-100 ${
										agent.id === selectedId ? 'bg-gray-alpha-100 text-gray-1000' : 'text-gray-800'
									}`}
								>
									<span
										className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${agent.status === 'running' ? 'bg-green-500' : 'bg-gray-400'}`}
									/>
									<span className="truncate">{agent.name}</span>
									<Badge variant={agent.status === 'running' ? 'green' : 'gray'} size="sm" className="ml-auto">
										{agent.status}
									</Badge>
								</button>
							))
						)}
					</div>
				</>
			)}
		</div>
	);
}
