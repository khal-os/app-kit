'use client';

import { Mic, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { EmptyState, StatusBar } from '@/components/os-primitives';
import { Button } from '@/components/ui/button';
import { Note } from '@/components/ui/note';
import { Spinner } from '@/components/ui/spinner';
import { useNats } from '@/lib/hooks/use-nats';
import { AgentCard } from './AgentCard';
import { AgentFormDialog } from './AgentFormDialog';
import { useAgents } from './hooks/useAgents';
import type { AgentConfig } from './types';

export function AgentManager(_props: { windowId: string; meta?: Record<string, unknown> }) {
	const { connected, request } = useNats();
	const { agents, loading, error, refresh } = useAgents();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingAgent, setEditingAgent] = useState<AgentConfig | undefined>();

	const openCreate = useCallback(() => {
		setEditingAgent(undefined);
		setDialogOpen(true);
	}, []);

	const openEdit = useCallback((agent: AgentConfig) => {
		setEditingAgent(agent);
		setDialogOpen(true);
	}, []);

	const closeDialog = useCallback(() => {
		setDialogOpen(false);
		setEditingAgent(undefined);
	}, []);

	const handleSave = useCallback(
		async (data: Partial<AgentConfig>) => {
			const subject = data.id ? 'hello.agent.update' : 'hello.agent.create';
			await request(subject, data);
			closeDialog();
			refresh();
		},
		[request, closeDialog, refresh]
	);

	return (
		<div className="flex h-full flex-col bg-background-100">
			<div className="flex items-center justify-between border-b border-border px-4 py-2">
				<h1 className="text-sm font-medium text-foreground">Agent Manager</h1>
				<Button size="small" prefix={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
					Create Agent
				</Button>
			</div>

			<div className="flex-1 overflow-auto">
				{loading && (
					<div className="flex h-full items-center justify-center">
						<Spinner size="lg" />
					</div>
				)}

				{!loading && error && (
					<div className="p-4">
						<Note type="error">{error}</Note>
					</div>
				)}

				{!loading && !error && agents.length === 0 && (
					<EmptyState
						icon={<Mic className="h-8 w-8" />}
						title="No agents configured"
						description="Create your first HELLO voice agent to get started."
						action={
							<Button size="small" prefix={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
								Create Agent
							</Button>
						}
					/>
				)}

				{!loading && !error && agents.length > 0 && (
					<div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
						{agents.map((agent) => (
							<AgentCard key={agent.id} agent={agent} onEdit={openEdit} />
						))}
					</div>
				)}
			</div>

			<StatusBar>
				<StatusBar.Item
					variant={connected ? 'success' : 'warning'}
					icon={
						<span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-amber-400'}`} />
					}
				>
					{connected ? 'Connected' : 'Disconnected'}
				</StatusBar.Item>
				<StatusBar.Separator />
				<StatusBar.Item>
					{agents.length} agent{agents.length !== 1 ? 's' : ''}
				</StatusBar.Item>
				<StatusBar.Spacer />
				<StatusBar.Item onClick={refresh}>Refresh</StatusBar.Item>
			</StatusBar>

			<AgentFormDialog open={dialogOpen} agent={editingAgent} onSave={handleSave} onClose={closeDialog} />
		</div>
	);
}
