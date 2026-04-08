/**
 * QA report types — migrated from D3kQaReport.
 *
 * Structured output format for QA commands: routes tested, screenshots,
 * console/JS errors, network stats, DOM checks, and a pass/fail summary.
 */

export interface QaRouteErrors {
	exceptions: number;
	console_errors: number;
}

export interface QaRouteNetwork {
	total: number;
	failed: number;
}

export interface QaScreenshot {
	route: string;
	file: string;
	viewport: string;
}

export interface QaDomCheck {
	route: string;
	selector: string;
	check: string;
	pass: boolean;
}

export interface QaSummary {
	pass: boolean;
	routes_passed: number;
	routes_failed: number;
	total_errors: number;
	total_failed_network: number;
	screenshots_taken: number;
}

export interface QaReport {
	timestamp: string;
	duration_ms: number;
	routes_tested: string[];
	screenshots: QaScreenshot[];
	errors: {
		js_exceptions: unknown[];
		console_errors: unknown[];
		by_route: Record<string, QaRouteErrors>;
	};
	network: {
		total_requests: number;
		failed_requests: number;
		slow_requests: unknown[];
		by_route: Record<string, QaRouteNetwork>;
	};
	dom_checks: QaDomCheck[];
	summary: QaSummary;
}
