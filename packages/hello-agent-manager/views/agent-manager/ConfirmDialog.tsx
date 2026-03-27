'use client';
import { Button } from '@khal-os/ui';

interface ConfirmDialogProps {
	open: boolean;
	title: string;
	description: string;
	confirmLabel?: string;
	confirmVariant?: 'default' | 'error';
	onConfirm: () => void;
	onCancel: () => void;
	loading?: boolean;
}

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel = 'Confirm',
	confirmVariant = 'default',
	onConfirm,
	onCancel,
	loading,
}: ConfirmDialogProps) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-background-100 p-4 shadow-xl">
				<h3 className="font-medium text-foreground">{title}</h3>
				<p className="mt-1 text-sm text-muted">{description}</p>
				<div className="mt-4 flex justify-end gap-2">
					<Button size="small" variant="ghost" onClick={onCancel} disabled={loading}>
						Cancel
					</Button>
					<Button size="small" variant={confirmVariant} onClick={onConfirm} loading={loading}>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
