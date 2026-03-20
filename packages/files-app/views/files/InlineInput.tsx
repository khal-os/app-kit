'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface InlineRenameInputProps {
	name: string;
	onSubmit: (oldName: string, newName: string) => void;
	className?: string;
}

/**
 * Inline rename input. Enter confirms, Escape and blur cancel (revert to original name).
 */
export function InlineRenameInput({ name, onSubmit, className }: InlineRenameInputProps) {
	const [value, setValue] = useState(name);
	const inputRef = useRef<HTMLInputElement>(null);
	const confirmedRef = useRef(false);

	useEffect(() => {
		const input = inputRef.current;
		if (input) {
			input.focus();
			const dotIndex = name.lastIndexOf('.');
			if (dotIndex > 0) {
				input.setSelectionRange(0, dotIndex);
			} else {
				input.select();
			}
		}
	}, [name]);

	const handleConfirm = useCallback(() => {
		if (confirmedRef.current) return;
		confirmedRef.current = true;
		onSubmit(name, value);
	}, [name, value, onSubmit]);

	const handleCancel = useCallback(() => {
		if (confirmedRef.current) return;
		confirmedRef.current = true;
		onSubmit(name, name);
	}, [name, onSubmit]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				handleConfirm();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				handleCancel();
			}
		},
		[handleConfirm, handleCancel]
	);

	return (
		<input
			ref={inputRef}
			type="text"
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleCancel}
			onKeyDown={handleKeyDown}
			className={`w-full rounded border border-blue-500 bg-transparent px-1 text-label-13 outline-none ${className ?? ''}`}
			style={{ color: 'var(--os-text-primary)' }}
			onClick={(e) => e.stopPropagation()}
		/>
	);
}

interface NewFolderInputProps {
	onSubmit: (name: string) => void;
	className?: string;
}

/**
 * Inline new-folder name input. Enter confirms, Escape and blur cancel.
 */
export function NewFolderInput({ onSubmit, className }: NewFolderInputProps) {
	const [value, setValue] = useState('New Folder');
	const inputRef = useRef<HTMLInputElement>(null);
	const confirmedRef = useRef(false);

	useEffect(() => {
		const input = inputRef.current;
		if (input) {
			input.focus();
			input.select();
		}
	}, []);

	const handleConfirm = useCallback(() => {
		if (confirmedRef.current) return;
		confirmedRef.current = true;
		onSubmit(value);
	}, [value, onSubmit]);

	const handleCancel = useCallback(() => {
		if (confirmedRef.current) return;
		confirmedRef.current = true;
		onSubmit('');
	}, [onSubmit]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				handleConfirm();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				handleCancel();
			}
		},
		[handleConfirm, handleCancel]
	);

	return (
		<input
			ref={inputRef}
			type="text"
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={handleCancel}
			onKeyDown={handleKeyDown}
			className={`w-full rounded border border-blue-500 bg-transparent px-1 text-label-13 outline-none ${className ?? ''}`}
			style={{ color: 'var(--os-text-primary)' }}
			onClick={(e) => e.stopPropagation()}
		/>
	);
}
