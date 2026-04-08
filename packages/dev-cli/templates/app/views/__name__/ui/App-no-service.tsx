'use client';

interface AppComponentProps {
	windowId: string;
	meta?: Record<string, unknown>;
}

export function {componentName}
({ windowId }
: AppComponentProps)
{
	return (
		<div className="flex flex-col gap-4 p-4">
			<h1 className="text-lg font-semibold">{{label}}</h1>
			<p className="text-sm text-muted-foreground">{{description}}</p>
		</div>
	);
}
