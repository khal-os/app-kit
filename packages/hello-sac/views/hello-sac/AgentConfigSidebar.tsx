'use client';

import { Button, Input } from '@khal-os/ui';
import { ChevronRight, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AgentConfig } from '../../lib/types';

interface AgentConfigSidebarProps {
	config: AgentConfig | null;
	collapsed: boolean;
	onToggle: () => void;
	onSave: (config: Partial<AgentConfig> & { slug: string }) => Promise<void>;
}

const VOICES = ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Sulafat', 'Sadaltager', 'Leda', 'Orus', 'Puck'];
const LANGUAGES = ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE'];

export function AgentConfigSidebar({ config, collapsed, onToggle, onSave }: AgentConfigSidebarProps) {
	const [draft, setDraft] = useState<Partial<AgentConfig>>({});
	const [saving, setSaving] = useState(false);

	// Sync draft with config changes
	useEffect(() => {
		if (config) {
			setDraft({
				system_prompt: config.system_prompt,
				voice_id: config.voice_id,
				language: config.language,
				targetNumber: config.targetNumber,
				max_duration_sec: config.max_duration_sec,
				daily_budget_usd: config.daily_budget_usd,
			});
		}
	}, [config]);

	const handleSave = useCallback(async () => {
		if (!config) return;
		setSaving(true);
		try {
			await onSave({ slug: config.slug, ...draft });
		} finally {
			setSaving(false);
		}
	}, [config, draft, onSave]);

	const updateField = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
		setDraft((prev) => ({ ...prev, [key]: value }));
	};

	if (collapsed) {
		return (
			<button
				type="button"
				onClick={onToggle}
				className="flex h-full w-8 items-center justify-center border-l border-white/5 bg-background-100 text-gray-500 hover:bg-background-200 hover:text-gray-300"
			>
				<ChevronRight className="h-4 w-4 rotate-180" />
			</button>
		);
	}

	return (
		<div className="flex h-full w-[280px] flex-col border-l border-white/5 bg-background-100">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
				<span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Agent Config</span>
				<button type="button" onClick={onToggle} className="text-gray-500 hover:text-gray-300">
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>

			{!config ? (
				<div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-gray-600">
					No agent selected
				</div>
			) : (
				<div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 scrollbar-thin">
					{/* Name (read-only) */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Name</label>
						<span className="rounded bg-background-200 px-2 py-1 text-xs text-gray-300">{config.name}</span>
					</div>

					{/* System Prompt */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">System Prompt</label>
						<textarea
							className="min-h-[100px] w-full resize-y rounded-md border border-white/10 bg-background-200 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500/50"
							value={draft.system_prompt ?? ''}
							onChange={(e) => updateField('system_prompt', e.target.value)}
						/>
					</div>

					{/* Voice */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Voice</label>
						<select
							className="w-full rounded-md border border-white/10 bg-background-200 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500/50"
							value={draft.voice_id ?? ''}
							onChange={(e) => updateField('voice_id', e.target.value)}
						>
							{VOICES.map((v) => (
								<option key={v} value={v}>
									{v}
								</option>
							))}
						</select>
					</div>

					{/* Language */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Language</label>
						<select
							className="w-full rounded-md border border-white/10 bg-background-200 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500/50"
							value={draft.language ?? ''}
							onChange={(e) => updateField('language', e.target.value)}
						>
							{LANGUAGES.map((l) => (
								<option key={l} value={l}>
									{l}
								</option>
							))}
						</select>
					</div>

					{/* Target Number */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Target Number</label>
						<Input
							type="tel"
							placeholder="+55..."
							value={draft.targetNumber ?? ''}
							onChange={(e) => updateField('targetNumber', e.target.value)}
							className="bg-background-200 text-xs"
						/>
					</div>

					{/* Flow (read-only) */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Flow</label>
						<span className="rounded bg-background-200 px-2 py-1 text-xs italic text-gray-500">
							{config.flow_json ? 'Custom Flow' : 'Freeform'}
						</span>
					</div>

					{/* Max Duration */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Max Duration (sec)</label>
						<Input
							type="number"
							min={60}
							max={3600}
							value={draft.max_duration_sec ?? 600}
							onChange={(e) => updateField('max_duration_sec', Number(e.target.value))}
							className="bg-background-200 text-xs"
						/>
					</div>

					{/* Daily Budget */}
					<div className="flex flex-col gap-1">
						<label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Daily Budget (USD)</label>
						<Input
							type="number"
							min={0}
							step={0.5}
							value={draft.daily_budget_usd ?? 5}
							onChange={(e) => updateField('daily_budget_usd', Number(e.target.value))}
							className="bg-background-200 text-xs"
						/>
					</div>

					{/* Save Button */}
					<Button
						className="mt-2 gap-2 bg-blue-600 text-white hover:bg-blue-500"
						onClick={handleSave}
						disabled={saving}
					>
						<Save className="h-3.5 w-3.5" />
						{saving ? 'Saving...' : 'Save Config'}
					</Button>
				</div>
			)}
		</div>
	);
}
