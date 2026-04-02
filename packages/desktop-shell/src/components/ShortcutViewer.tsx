import { useEffect } from 'react';
import type { ShortcutCategory } from '../lib/keyboard/types';
import { comboToSymbols } from '../lib/keyboard/types';
import { useKeybindStore } from '../stores/keybind-store';

interface ShortcutViewerProps {
	visible: boolean;
	onClose: () => void;
}

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
	window: 'Window',
	workspace: 'Workspace',
	launcher: 'Launcher',
	terminal: 'Terminal',
	system: 'System',
};

const CATEGORY_ORDER: ShortcutCategory[] = ['window', 'launcher', 'terminal', 'system', 'workspace'];

export function ShortcutViewer({ visible, onClose }: ShortcutViewerProps) {
	const { definitions, getBinding } = useKeybindStore();

	useEffect(() => {
		if (!visible) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};

		window.addEventListener('keydown', handleEscape, { capture: true });
		return () => window.removeEventListener('keydown', handleEscape, { capture: true });
	}, [visible, onClose]);

	if (!visible) return null;

	// Group shortcuts by category
	const byCategory = definitions.reduce(
		(acc, def) => {
			if (!acc[def.category]) acc[def.category] = [];
			acc[def.category].push(def);
			return acc;
		},
		{} as Record<ShortcutCategory, typeof definitions>
	);

	return (
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center backdrop-blur-sm"
			style={{ background: 'rgba(0,0,0,0.5)' }}
			onClick={onClose}
		>
			<div
				className="max-h-[80vh] w-[700px] overflow-y-auto rounded-xl"
				style={{
					background: 'var(--khal-surface-raised)',
					border: '1px solid var(--khal-border-default)',
					boxShadow: 'var(--khal-shadow-xl)',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div
					className="sticky top-0 px-6 py-4"
					style={{
						background: 'var(--khal-surface-raised)',
						borderBottom: '1px solid var(--khal-border-default)',
					}}
				>
					<h2 className="text-copy-18 font-semibold" style={{ color: 'var(--khal-text-primary)' }}>
						Keyboard Shortcuts
					</h2>
					<p className="text-copy-13" style={{ color: 'var(--khal-text-muted)' }}>
						Press Esc to close
					</p>
				</div>

				<div className="px-6 py-4">
					{CATEGORY_ORDER.map((category) => {
						const shortcuts = byCategory[category];
						if (!shortcuts || shortcuts.length === 0) return null;

						return (
							<div key={category} className="mb-6 last:mb-0">
								<h3 className="mb-3 text-copy-14 font-semibold" style={{ color: 'var(--khal-text-secondary)' }}>
									{CATEGORY_LABELS[category]}
								</h3>
								<div className="space-y-2">
									{shortcuts.map((def) => {
										const binding = getBinding(def.id);
										if (!binding) return null;

										return (
											<div
												key={def.id}
												className="flex items-center justify-between rounded-lg px-4 py-2.5"
												style={{ background: 'var(--khal-surface-sunken)' }}
											>
												<div className="flex flex-col">
													<span className="text-copy-13 font-medium" style={{ color: 'var(--khal-text-primary)' }}>
														{def.label}
													</span>
													{def.description && (
														<span className="text-copy-12" style={{ color: 'var(--khal-text-muted)' }}>
															{def.description}
														</span>
													)}
												</div>
												<kbd
													className="ml-4 flex-shrink-0 rounded-md px-3 py-1.5 font-mono text-copy-13"
													style={{
														background: 'var(--khal-surface-default)',
														color: 'var(--khal-text-secondary)',
														boxShadow: 'var(--khal-shadow-sm)',
														border: '1px solid var(--khal-border-subtle)',
													}}
												>
													{comboToSymbols(binding)}
												</kbd>
											</div>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
