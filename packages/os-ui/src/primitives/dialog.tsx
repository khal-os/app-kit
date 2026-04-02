'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Minimal compound Dialog primitive for OS chrome.                   */
/*  Enough to satisfy DeleteConfirmDialog; expand as needed.           */
/* ------------------------------------------------------------------ */

interface DialogRootProps {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
}

function DialogRoot({ open, onClose, children }: DialogRootProps) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
			<div
				className="bg-popover text-popover-foreground rounded-lg border p-6 shadow-lg"
				onClick={(e) => e.stopPropagation()}
			>
				{children}
			</div>
		</div>
	);
}

function Body({ children }: { children: ReactNode }) {
	return <div className="flex items-start gap-4">{children}</div>;
}

function Icon({ children, variant: _variant }: { children: ReactNode; variant?: string }) {
	return <div className="shrink-0">{children}</div>;
}

function Title({ children }: { children: ReactNode }) {
	return <h2 className="text-lg font-semibold">{children}</h2>;
}

function Description({ children }: { children: ReactNode }) {
	return <p className="text-muted-foreground text-sm">{children}</p>;
}

function Actions({ children }: { children: ReactNode }) {
	return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string };

function Cancel({ children, ...props }: BtnProps) {
	return (
		<button type="button" className="rounded px-3 py-1.5 text-sm hover:bg-muted" {...props}>
			{children}
		</button>
	);
}

function Confirm({ children, variant: _variant, ...props }: BtnProps) {
	return (
		<button type="button" className="rounded bg-destructive px-3 py-1.5 text-sm text-destructive-foreground" {...props}>
			{children}
		</button>
	);
}

export const Dialog = Object.assign(DialogRoot, {
	Body,
	Icon,
	Title,
	Description,
	Actions,
	Cancel,
	Confirm,
});
