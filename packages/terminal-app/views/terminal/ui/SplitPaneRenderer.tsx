'use client';

import { useState } from 'react';
import type { SplitNode } from '../types';
import { SplitDragHandle } from './SplitDragHandle';
import { TerminalPane } from './TerminalPane';

interface SplitPaneRendererProps {
	node: SplitNode;
	focusedPaneId: string;
	onPaneFocus: (paneId: string) => void;
	onSessionIdChange: (paneId: string, sessionId: string) => void;
	onKeyboardShortcut?: (event: KeyboardEvent) => boolean;
	onRatioChange?: (nodeId: string, ratio: number) => void;
	onCwdChange?: (paneId: string, cwd: string) => void;
	onLastCommandChange?: (paneId: string, command: string) => void;
}

/**
 * Recursive renderer for split pane tree.
 * Branch nodes render two children with a draggable divider.
 * Leaf nodes render a TerminalPane component.
 */
export function SplitPaneRenderer({
	node,
	focusedPaneId,
	onPaneFocus,
	onSessionIdChange,
	onKeyboardShortcut,
	onRatioChange,
	onCwdChange,
	onLastCommandChange,
}: SplitPaneRendererProps) {
	const [localRatio, setLocalRatio] = useState(0.5);

	if (node.type === 'leaf') {
		return (
			<TerminalPane
				paneId={node.id}
				ptySessionId={node.ptySessionId}
				isFocused={node.id === focusedPaneId}
				onFocus={() => onPaneFocus(node.id)}
				onSessionIdChange={(sessionId) => onSessionIdChange(node.id, sessionId)}
				onKeyboardShortcut={onKeyboardShortcut}
				onCwdChange={onCwdChange ? (cwd) => onCwdChange(node.id, cwd) : undefined}
				onLastCommandChange={onLastCommandChange ? (cmd) => onLastCommandChange(node.id, cmd) : undefined}
			/>
		);
	}

	// Branch node: render two children with divider
	const ratio = node.ratio ?? localRatio;
	const isVertical = node.direction === 'vertical';

	const handleRatioChange = (newRatio: number) => {
		setLocalRatio(newRatio);
		if (onRatioChange) {
			onRatioChange(node.id, newRatio);
		}
	};

	return (
		<div
			className={`
        split-container
        flex ${isVertical ? 'flex-row' : 'flex-col'}
        h-full w-full
      `}
		>
			{/* First child */}
			<div
				style={{
					flex: `0 0 ${ratio * 100}%`,
					overflow: 'hidden',
				}}
			>
				<SplitPaneRenderer
					node={node.children[0]}
					focusedPaneId={focusedPaneId}
					onPaneFocus={onPaneFocus}
					onSessionIdChange={onSessionIdChange}
					onKeyboardShortcut={onKeyboardShortcut}
					onRatioChange={onRatioChange}
					onCwdChange={onCwdChange}
					onLastCommandChange={onLastCommandChange}
				/>
			</div>

			{/* Drag handle */}
			<SplitDragHandle direction={node.direction} onRatioChange={handleRatioChange} />

			{/* Second child */}
			<div
				style={{
					flex: 1,
					overflow: 'hidden',
				}}
			>
				<SplitPaneRenderer
					node={node.children[1]}
					focusedPaneId={focusedPaneId}
					onPaneFocus={onPaneFocus}
					onSessionIdChange={onSessionIdChange}
					onKeyboardShortcut={onKeyboardShortcut}
					onRatioChange={onRatioChange}
					onCwdChange={onCwdChange}
					onLastCommandChange={onLastCommandChange}
				/>
			</div>
		</div>
	);
}
