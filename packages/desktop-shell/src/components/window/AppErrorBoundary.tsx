import { AlertTriangle, RefreshCw } from 'lucide-react';
import React from 'react';

interface AppErrorBoundaryProps {
	appName: string;
	children: React.ReactNode;
}

interface AppErrorBoundaryState {
	hasError: boolean;
	error?: Error;
	resetKey: number;
}

function ErrorFallback({ appName, error, onRestart }: { appName: string; error?: Error; onRestart: () => void }) {
	return (
		<div
			className="flex h-full flex-col items-center justify-center gap-4 p-6"
			style={{ color: 'var(--khal-text-primary)' }}
		>
			<div
				className="flex h-12 w-12 items-center justify-center rounded-xl"
				style={{ background: 'var(--khal-surface-raised, rgba(255,59,48,0.1))' }}
			>
				<AlertTriangle size={24} style={{ color: 'var(--khal-accent-red, #ff3b30)' }} />
			</div>
			<div className="text-center">
				<h3 className="text-sm font-semibold" style={{ color: 'var(--khal-text-primary)' }}>
					{appName} encountered an error
				</h3>
				{error && (
					<p className="mt-1 max-w-sm text-xs" style={{ color: 'var(--khal-text-muted)' }}>
						{error.message}
					</p>
				)}
			</div>
			<div className="flex gap-2">
				<button
					type="button"
					className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
					style={{
						background: 'var(--khal-surface-raised, rgba(255,255,255,0.1))',
						color: 'var(--khal-text-primary)',
						border: '1px solid var(--khal-border-default)',
					}}
					onClick={onRestart}
				>
					<RefreshCw size={12} />
					Restart
				</button>
			</div>
		</div>
	);
}

/**
 * React error boundary that wraps app components.
 * On crash: renders fallback UI -- "App encountered an error" with Restart button.
 */
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
	constructor(props: AppErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, resetKey: 0 };
	}

	static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, info: React.ErrorInfo) {
		// biome-ignore lint/suspicious/noConsole: error boundaries must log crashes for debugging
		console.error(`[AppErrorBoundary] ${this.props.appName} crashed:`, error, info.componentStack);
	}

	handleRestart = () => {
		this.setState((prev) => ({
			hasError: false,
			error: undefined,
			resetKey: prev.resetKey + 1,
		}));
	};

	override render() {
		if (this.state.hasError) {
			return <ErrorFallback appName={this.props.appName} error={this.state.error} onRestart={this.handleRestart} />;
		}
		return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
	}
}
