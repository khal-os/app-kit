'use client';

import { useCallback, useRef } from 'react';

interface SplitDragHandleProps {
	direction: 'horizontal' | 'vertical';
	onRatioChange: (ratio: number) => void;
}

/**
 * Draggable divider between split panes.
 * Vertical split = horizontal drag handle (side by side panes).
 * Horizontal split = vertical drag handle (top/bottom panes).
 */
export function SplitDragHandle({ direction, onRatioChange }: SplitDragHandleProps) {
	const isDraggingRef = useRef(false);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isDraggingRef.current = true;

			// Find the parent split container
			let parent = e.currentTarget.parentElement;
			while (parent && !parent.classList.contains('split-container')) {
				parent = parent.parentElement;
			}
			containerRef.current = parent as HTMLDivElement;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				if (!isDraggingRef.current || !containerRef.current) return;

				const rect = containerRef.current.getBoundingClientRect();
				let ratio: number;

				if (direction === 'vertical') {
					// Vertical split: side by side, calculate X position
					const x = moveEvent.clientX - rect.left;
					ratio = x / rect.width;
				} else {
					// Horizontal split: top/bottom, calculate Y position
					const y = moveEvent.clientY - rect.top;
					ratio = y / rect.height;
				}

				// Clamp ratio between 0.1 and 0.9 to prevent extremely small panes
				ratio = Math.max(0.1, Math.min(0.9, ratio));
				onRatioChange(ratio);
			};

			const handleMouseUp = () => {
				isDraggingRef.current = false;
				containerRef.current = null;
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
		},
		[direction, onRatioChange]
	);

	const isVerticalSplit = direction === 'vertical';

	return (
		<div
			className={`
				split-handle
				${isVerticalSplit ? 'w-1 h-full cursor-col-resize' : 'h-1 w-full cursor-row-resize'}
				transition-colors
				relative
			`}
			style={{ background: 'var(--os-border-default)' }}
			onMouseEnter={(e) => {
				(e.currentTarget as HTMLElement).style.background = 'var(--os-split-handle-accent)';
			}}
			onMouseLeave={(e) => {
				(e.currentTarget as HTMLElement).style.background = 'var(--os-border-default)';
			}}
			onMouseDown={handleMouseDown}
		>
			{/* Visual indicator on hover */}
			<div
				className="absolute inset-0 opacity-0 hover:opacity-20 transition-opacity"
				style={{ background: 'var(--os-split-handle-accent)' }}
			/>
		</div>
	);
}
