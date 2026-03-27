"use client";

interface CostBarProps {
	spent: number;
	budget: number;
}

export function CostBar({ spent, budget }: CostBarProps) {
	const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
	const color =
		pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500";

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between text-xs text-muted">
				<span>
					${spent.toFixed(2)} / ${budget.toFixed(2)}
				</span>
				<span>{pct.toFixed(0)}%</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-alpha-200">
				<div
					className={`h-full rounded-full transition-all ${color}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}
