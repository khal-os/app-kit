import { Spinner } from '@khal-os/ui';

interface BundleLoadingSpinnerProps {
	appName: string;
}

/** Loading fallback shown inside a window while an ESM bundle is being fetched. */
export function BundleLoadingSpinner({ appName }: BundleLoadingSpinnerProps) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3">
			<Spinner size="lg" />
			<span className="text-xs" style={{ color: 'var(--khal-text-muted)' }}>
				Loading {appName}…
			</span>
		</div>
	);
}
