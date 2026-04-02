'use client';

import { Dialog } from '@khal-os/ui';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmDialogProps {
	/** Names of items to delete */
	names: string[];
	onConfirm: () => void;
	onCancel: () => void;
}

export function DeleteConfirmDialog({ names, onConfirm, onCancel }: DeleteConfirmDialogProps) {
	const label = names.length === 1 ? names[0] : `${names.length} items`;

	return (
		<Dialog open={true} onClose={onCancel}>
			<Dialog.Body>
				<Dialog.Icon variant="destructive">
					<Trash2 />
				</Dialog.Icon>
				<div className="flex flex-col gap-1">
					<Dialog.Title>Delete {label}?</Dialog.Title>
					<Dialog.Description>
						{names.length === 1
							? 'This action cannot be undone.'
							: `This will permanently delete ${names.length} items.`}
					</Dialog.Description>
				</div>
			</Dialog.Body>
			<Dialog.Actions>
				<Dialog.Cancel onClick={onCancel}>Cancel</Dialog.Cancel>
				<Dialog.Confirm variant="destructive" onClick={onConfirm}>
					Delete
				</Dialog.Confirm>
			</Dialog.Actions>
		</Dialog>
	);
}
