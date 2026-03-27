'use client';

import { StatusBar } from '@/components/os-primitives';

export function AgentManager(_props: { windowId: string; meta?: Record<string, unknown> }) {
	return (
		<div className="flex h-full flex-col bg-background-100">
			<div className="flex flex-1 items-center justify-center">
				<h1 className="text-lg font-medium text-foreground">Agent Manager</h1>
			</div>
			<StatusBar>
				<StatusBar.Item>Agent Manager</StatusBar.Item>
				<StatusBar.Spacer />
				<StatusBar.Item variant="default">Ready</StatusBar.Item>
			</StatusBar>
		</div>
	);
}
