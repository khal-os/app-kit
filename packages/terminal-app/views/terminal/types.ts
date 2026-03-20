/**
 * Terminal tab data model for multi-tab terminal.
 */
export interface TerminalTab {
	id: string;
	ptySessionId: string | null; // assigned on connect (legacy, kept for compatibility)
	title: string; // from OSC or fallback
	cwd: string | null; // from OSC 7
	lastCommand: string | null; // from input tracking
	splitTree: SplitNode; // recursive split tree (root starts as single leaf)
	focusedPaneId: string; // which pane in the split tree is focused
}

/**
 * Recursive split pane tree structure.
 * A tab's content is either a single pane (leaf) or a split container (branch).
 */
export type SplitNode =
	| { type: 'leaf'; id: string; ptySessionId: string | null; cwd: string | null; lastCommand: string | null }
	| {
			type: 'branch';
			id: string;
			direction: 'horizontal' | 'vertical';
			children: [SplitNode, SplitNode];
			ratio: number;
	  };
