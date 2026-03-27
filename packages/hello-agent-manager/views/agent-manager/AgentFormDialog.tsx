'use client';

import { AgentForm } from './AgentForm';
import type { AgentConfig } from './types';

interface AgentFormDialogProps {
	open: boolean;
	agent?: AgentConfig;
	onSave: (data: Partial<AgentConfig>) => void;
	onClose: () => void;
}

export function AgentFormDialog({ open, agent, onSave, onClose }: AgentFormDialogProps) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="mx-4 w-full max-w-lg rounded-lg border border-border bg-background-100 shadow-xl">
				<div className="border-b border-border px-4 py-3">
					<h2 className="text-sm font-medium">{agent ? 'Edit Agent' : 'Create Agent'}</h2>
				</div>
				<div className="max-h-[70vh] overflow-auto p-4">
					<AgentForm agent={agent} onSave={onSave} onCancel={onClose} />
				</div>
			</div>
		</div>
	);
}
