'use client';

import type { AppEnvVar } from '@khal-os/sdk/app';
import { useNats } from '@khal-os/sdk/app';
import { Button, Input, Note, SectionHeader, Toggle } from '@khal-os/ui';
import { useCallback, useEffect, useState } from 'react';

/** Props accepted by the AppConfigPanel. */
export interface AppConfigPanelProps {
	/** The app ID to configure. */
	appId: string;
	/** Pre-loaded env var schema. If omitted the panel fetches from the marketplace. */
	envSchema?: AppEnvVar[];
	/** Called after a successful save. */
	onSaved?: () => void;
}

/**
 * Renders a form for configuring an app's environment variables.
 *
 * Field types map to appropriate inputs:
 * - `string` / `url` => text input
 * - `number` => number input
 * - `boolean` => toggle switch
 * - `secret` => password input
 *
 * Save writes per-app env via `os.app.config.save` NATS request.
 */
export function AppConfigPanel({ appId, envSchema, onSaved }: AppConfigPanelProps) {
	const { connected, request } = useNats();
	const [fields, setFields] = useState<AppEnvVar[]>(envSchema ?? []);
	const [values, setValues] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(!envSchema);

	// Fetch env schema from marketplace if not provided via props
	useEffect(() => {
		if (envSchema) {
			setFields(envSchema);
			setLoading(false);
			return;
		}
		if (!connected) return;

		const fetchSchema = async () => {
			try {
				const reply = await request('os.marketplace.installed', {});
				const apps = (reply as { apps?: Array<Record<string, unknown>> }).apps ?? [];
				const app = apps.find((a) => a.id === appId);
				if (app && Array.isArray(app.env)) {
					setFields(app.env as AppEnvVar[]);
				}
			} catch {
				// silent — fields will remain empty
			} finally {
				setLoading(false);
			}
		};
		fetchSchema();
	}, [appId, connected, envSchema, request]);

	// Fetch current saved values
	useEffect(() => {
		if (!connected) return;

		const fetchValues = async () => {
			try {
				const reply = await request('os.app.config.get', { appId });
				const saved = (reply as { env?: Record<string, string> }).env;
				if (saved) setValues(saved);
			} catch {
				// silent — start with defaults
			}
		};
		fetchValues();
	}, [appId, connected, request]);

	const setValue = useCallback((key: string, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
		setSuccess(false);
		setError(null);
	}, []);

	const handleSave = async () => {
		if (!connected) return;
		setSaving(true);
		setError(null);
		setSuccess(false);

		try {
			const reply = await request('os.app.config.save', { appId, env: values });
			const result = reply as { success?: boolean; error?: string };

			if (result.success === false) {
				setError(result.error ?? 'Save failed');
			} else {
				setSuccess(true);
				onSaved?.();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return <div className="px-4 py-3 text-copy-12 text-gray-700">Loading configuration...</div>;
	}

	if (fields.length === 0) {
		return (
			<div className="px-4 py-3 text-copy-12 text-gray-600">
				No configurable environment variables for this app.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<SectionHeader
				title="Environment Configuration"
				description={`Configure environment variables for ${appId}.`}
			/>

			<div className="flex flex-col gap-3">
				{fields.map((field) => (
					<EnvField
						key={field.key}
						field={field}
						value={values[field.key] ?? field.default ?? ''}
						onChange={(v) => setValue(field.key, v)}
					/>
				))}
			</div>

			{error && (
				<Note type="error" size="small">
					{error}
				</Note>
			)}

			{success && (
				<Note type="success" size="small">
					Configuration saved successfully.
				</Note>
			)}

			<div className="flex justify-end">
				<Button size="small" variant="secondary" onClick={handleSave} disabled={saving || !connected}>
					{saving ? 'Saving...' : 'Save Configuration'}
				</Button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Per-field renderer
// ---------------------------------------------------------------------------

interface EnvFieldProps {
	field: AppEnvVar;
	value: string;
	onChange: (value: string) => void;
}

function EnvField({ field, value, onChange }: EnvFieldProps) {
	const fieldType = field.type ?? 'string';

	return (
		<div className="flex items-start gap-3">
			<label
				className="w-44 shrink-0 pt-1.5 text-copy-12 font-medium text-gray-900"
				title={field.description}
			>
				{field.key}
				{field.required && <span className="ml-0.5 text-red-600">*</span>}
			</label>

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				{fieldType === 'boolean' ? (
					<Toggle
						checked={value === 'true'}
						onChange={() => onChange(value === 'true' ? 'false' : 'true')}
					/>
				) : (
					<Input
						size="small"
						type={fieldType === 'secret' ? 'password' : fieldType === 'number' ? 'number' : 'text'}
						placeholder={field.default ?? field.description}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						aria-label={field.key}
					/>
				)}
				{field.description && (
					<p className="text-copy-11 text-gray-600">{field.description}</p>
				)}
			</div>
		</div>
	);
}
