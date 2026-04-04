'use client';

import { useNats } from '@khal-os/sdk/app';
import { Button, Note, SectionHeader } from '@khal-os/ui';
import { useState } from 'react';

/** Props accepted by the AppExportPanel. */
export interface AppExportPanelProps {
	/** The app ID to export. */
	appId: string;
	/** Human-readable app name for the UI. Falls back to appId. */
	appName?: string;
	/** Whether the app supports Tauri export (controls button state). */
	exportable?: boolean;
}

interface ExportResult {
	success: boolean;
	message: string;
	outputPath?: string;
}

/**
 * "Export as Desktop App" panel.
 *
 * Publishes a NATS request to `os.app.export` with the app ID and displays
 * export status / progress feedback. The backend builds the Tauri binary and
 * returns the output path on success.
 */
export function AppExportPanel({ appId, appName, exportable = true }: AppExportPanelProps) {
	const { connected, request } = useNats();
	const [exporting, setExporting] = useState(false);
	const [result, setResult] = useState<ExportResult | null>(null);

	const displayName = appName ?? appId;

	const handleExport = async () => {
		if (!connected || exporting) return;
		setExporting(true);
		setResult(null);

		try {
			const reply = await request('os.app.export', { appId }, 120_000);
			const data = reply as { success: boolean; error?: string; outputPath?: string };

			setResult({
				success: data.success,
				message: data.success
					? `Export complete: ${data.outputPath ?? 'binary ready'}`
					: (data.error ?? 'Export failed — check that src-tauri/ exists in the app package.'),
				outputPath: data.outputPath,
			});
		} catch (err) {
			setResult({
				success: false,
				message:
					err instanceof Error
						? err.message
						: 'Export request failed. Ensure the app has tauri.exportable: true in khal-app.json.',
			});
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<SectionHeader
				title="Export as Desktop App"
				description={`Build a standalone Tauri desktop binary for ${displayName}.`}
			/>

			{!exportable && (
				<Note type="warning" size="small">
					This app does not support Tauri export. Set{' '}
					<code className="rounded bg-gray-alpha-100 px-1 font-mono text-copy-12">
						tauri.exportable: true
					</code>{' '}
					in khal-app.json to enable.
				</Note>
			)}

			<div className="flex items-center gap-3">
				<Button
					size="small"
					variant="secondary"
					onClick={handleExport}
					disabled={exporting || !exportable || !connected}
				>
					{exporting ? 'Exporting...' : 'Export'}
				</Button>

				{exporting && (
					<span className="text-copy-12 text-gray-700">
						Building desktop binary — this may take a few minutes...
					</span>
				)}
			</div>

			{result && (
				<Note type={result.success ? 'success' : 'error'} size="small">
					<strong>{displayName}:</strong> {result.message}
				</Note>
			)}
		</div>
	);
}
