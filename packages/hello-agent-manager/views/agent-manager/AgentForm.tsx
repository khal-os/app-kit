'use client';

import { Button, Input } from '@khal-os/ui';
import { useCallback, useEffect, useState } from 'react';
import type { AgentConfig } from './types';

const VOICES = ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda'] as const;
const LANGUAGES = ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE'] as const;
const TRANSPORTS = ['twilio', 'webrtc'] as const;

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

interface AgentFormProps {
	agent?: AgentConfig;
	onSave: (data: Partial<AgentConfig>) => void;
	onCancel: () => void;
}

export function AgentForm({ agent, onSave, onCancel }: AgentFormProps) {
	const [name, setName] = useState(agent?.name ?? '');
	const [slug, setSlug] = useState(agent?.slug ?? '');
	const [slugManual, setSlugManual] = useState(!!agent);
	const [voiceId, setVoiceId] = useState(agent?.voice_id ?? 'Kore');
	const [language, setLanguage] = useState(agent?.language ?? 'pt-BR');
	const [model] = useState(agent?.model ?? 'gemini-3.1-flash-live-preview');
	const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? '');
	const [transport, setTransport] = useState(agent?.transport ?? 'twilio');
	const [maxDuration, setMaxDuration] = useState(agent?.max_duration_sec ?? 600);
	const [maxConcurrent, setMaxConcurrent] = useState(agent?.max_concurrent ?? 3);
	const [dailyBudget, setDailyBudget] = useState(agent?.daily_budget_usd ?? 10);

	useEffect(() => {
		if (!slugManual) {
			setSlug(slugify(name));
		}
	}, [name, slugManual]);

	const handleSlugChange = useCallback((value: string) => {
		setSlugManual(true);
		setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
	}, []);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (!name.trim() || !slug.trim()) return;
			onSave({
				...(agent?.id ? { id: agent.id } : {}),
				name: name.trim(),
				slug: slug.trim(),
				voice_id: voiceId,
				language,
				model,
				system_prompt: systemPrompt,
				transport,
				max_duration_sec: maxDuration,
				max_concurrent: maxConcurrent,
				daily_budget_usd: dailyBudget,
			});
		},
		[
			name,
			slug,
			voiceId,
			language,
			model,
			systemPrompt,
			transport,
			maxDuration,
			maxConcurrent,
			dailyBudget,
			agent,
			onSave,
		]
	);

	const selectClass =
		'flex h-9 w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-13 text-gray-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1';

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-4">
			<Input
				label="Name"
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder="My Voice Agent"
				required
			/>

			<Input
				label="Slug"
				value={slug}
				onChange={(e) => handleSlugChange(e.target.value)}
				placeholder="my-voice-agent"
				required
			/>

			<div className="flex flex-col gap-1.5">
				<label className="text-label-13 text-gray-900">Voice</label>
				<select className={selectClass} value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
					{VOICES.map((v) => (
						<option key={v} value={v}>
							{v}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-label-13 text-gray-900">Language</label>
				<select className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
					{LANGUAGES.map((l) => (
						<option key={l} value={l}>
							{l}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-label-13 text-gray-900">Model</label>
				<select className={selectClass} value={model} disabled>
					<option value="gemini-3.1-flash-live-preview">gemini-3.1-flash-live-preview</option>
				</select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-label-13 text-gray-900">System Prompt</label>
				<textarea
					className="flex min-h-[80px] w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 py-2 text-copy-13 text-gray-1000 placeholder:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1"
					value={systemPrompt}
					onChange={(e) => setSystemPrompt(e.target.value)}
					placeholder="You are a helpful voice assistant..."
					rows={4}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-label-13 text-gray-900">Transport</label>
				<div className="flex gap-4">
					{TRANSPORTS.map((t) => (
						<label key={t} className="flex items-center gap-2 text-copy-13 text-gray-1000">
							<input
								type="radio"
								name="transport"
								value={t}
								checked={transport === t}
								onChange={() => setTransport(t)}
								className="accent-blue-700"
							/>
							{t === 'twilio' ? 'Twilio (phone)' : 'WebRTC (browser)'}
						</label>
					))}
				</div>
			</div>

			<div className="grid grid-cols-3 gap-3">
				<Input
					label="Max Duration (s)"
					typeName="number"
					value={String(maxDuration)}
					onChange={(e) => setMaxDuration(Number(e.target.value))}
					min={60}
					max={3600}
				/>
				<Input
					label="Max Concurrent"
					typeName="number"
					value={String(maxConcurrent)}
					onChange={(e) => setMaxConcurrent(Number(e.target.value))}
					min={1}
					max={100}
				/>
				<Input
					label="Daily Budget ($)"
					typeName="number"
					value={String(dailyBudget)}
					onChange={(e) => setDailyBudget(Number(e.target.value))}
					min={0}
					step={0.5}
				/>
			</div>

			<div className="flex justify-end gap-2 border-t border-border pt-4">
				<Button variant="secondary" size="small" onClick={onCancel} typeName="button">
					Cancel
				</Button>
				<Button size="small" typeName="submit" disabled={!name.trim() || !slug.trim()}>
					{agent ? 'Save Changes' : 'Create Agent'}
				</Button>
			</div>
		</form>
	);
}
