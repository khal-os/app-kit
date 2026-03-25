'use client';

import { useCallback, useState } from 'react';
import type { PipelineItem } from '../types';

/**
 * Mock data seeded from real genie-os engineering backlog.
 * Structured so NATS can replace this in v2 — just swap the data source.
 */
const MOCK_ITEMS: PipelineItem[] = [
	// --- draft ---
	{
		id: 'wish-001',
		slug: 'mobile-responsive-shell',
		title: 'Mobile Responsive Shell',
		summary:
			'Add responsive breakpoints and touch interactions to the KhalOS desktop shell for tablet/mobile viewports.',
		stage: 'draft',
		priority: 'low',
		assignee: 'Sofia',
		groups: null,
		createdAt: '2026-03-20T10:00:00Z',
		updatedAt: '2026-03-22T14:30:00Z',
	},
	{
		id: 'wish-002',
		slug: 'workflow-builder-ui',
		title: 'Workflow Builder UI',
		summary: 'Visual drag-and-drop editor for creating custom workflow stage definitions and gate conditions.',
		stage: 'draft',
		priority: 'medium',
		assignee: 'Gabriel',
		groups: null,
		createdAt: '2026-03-19T08:00:00Z',
		updatedAt: '2026-03-21T16:00:00Z',
	},

	// --- brainstorm ---
	{
		id: 'wish-003',
		slug: 'nats-live-subscriptions',
		title: 'NATS Live Subscriptions for Pipeline',
		summary:
			'Replace mock data with real-time NATS JetStream subscriptions for pipeline items. Subscribe to stage transitions and status updates.',
		stage: 'brainstorm',
		priority: 'high',
		assignee: 'Gabriel',
		groups: null,
		createdAt: '2026-03-18T12:00:00Z',
		updatedAt: '2026-03-22T09:15:00Z',
	},
	{
		id: 'wish-004',
		slug: 'agent-observability-dashboard',
		title: 'Agent Observability Dashboard',
		summary:
			'Metrics and trace visualization for agent sessions: token usage, tool calls, errors, and session timelines.',
		stage: 'brainstorm',
		priority: 'medium',
		assignee: 'Sofia',
		groups: null,
		createdAt: '2026-03-17T14:00:00Z',
		updatedAt: '2026-03-20T11:00:00Z',
	},

	// --- wish ---
	{
		id: 'wish-005',
		slug: 'notification-center',
		title: 'Notification Center',
		summary:
			'System-wide notification panel with toast popups, persistent history, and per-app notification preferences.',
		stage: 'wish',
		priority: 'medium',
		assignee: 'Sofia',
		groups: { done: 0, total: 3 },
		createdAt: '2026-03-15T09:00:00Z',
		updatedAt: '2026-03-19T15:00:00Z',
	},
	{
		id: 'wish-006',
		slug: 'file-manager-v2',
		title: 'File Manager v2',
		summary: 'Tree view, breadcrumbs, drag-drop upload, preview pane, and integration with the OS virtual filesystem.',
		stage: 'wish',
		priority: 'high',
		assignee: 'Gabriel',
		groups: { done: 0, total: 4 },
		createdAt: '2026-03-14T11:00:00Z',
		updatedAt: '2026-03-18T10:30:00Z',
	},

	// --- build ---
	{
		id: 'wish-007',
		slug: 'khalos-design-system-pipeline',
		title: 'Design System Components + Pipeline Board',
		summary:
			'GlassCard, StatusDot, ProgressBar, Avatar components and 7-column Pipeline Board kanban view for genie-app.',
		stage: 'build',
		priority: 'critical',
		assignee: 'Gabriel',
		groups: { done: 2, total: 3 },
		createdAt: '2026-03-22T08:00:00Z',
		updatedAt: '2026-03-24T09:00:00Z',
	},
	{
		id: 'wish-008',
		slug: 'one-theme-tokens',
		title: 'ONE Theme Token System',
		summary:
			'Unified design token architecture: stage colors, glass surfaces, product identity, status indicators, and animation presets.',
		stage: 'build',
		priority: 'high',
		assignee: 'Sofia',
		groups: { done: 3, total: 5 },
		createdAt: '2026-03-20T07:00:00Z',
		updatedAt: '2026-03-23T18:00:00Z',
	},
	{
		id: 'wish-009',
		slug: 'terminal-session-persistence',
		title: 'Terminal Session Persistence',
		summary: 'Persist terminal sessions across page reloads with 72h TTL ring buffer and client-initiated replay.',
		stage: 'build',
		priority: 'medium',
		assignee: 'Gabriel',
		groups: { done: 1, total: 2 },
		createdAt: '2026-03-16T10:00:00Z',
		updatedAt: '2026-03-22T12:00:00Z',
	},

	// --- review ---
	{
		id: 'wish-010',
		slug: 'ws-bridge-auth',
		title: 'WebSocket Bridge Authentication',
		summary: 'Add WorkOS session validation to the WS-to-NATS bridge with machine auth bypass for headless Chrome.',
		stage: 'review',
		priority: 'high',
		assignee: 'Sofia',
		groups: { done: 2, total: 2 },
		createdAt: '2026-03-12T09:00:00Z',
		updatedAt: '2026-03-21T17:00:00Z',
	},
	{
		id: 'wish-011',
		slug: 'service-loader-runtime-detection',
		title: 'Service Loader Runtime Detection',
		summary: 'Auto-detect Bun vs Node runtime per service using runtime marker file. Enables node-pty under tsx.',
		stage: 'review',
		priority: 'medium',
		assignee: 'Gabriel',
		groups: { done: 3, total: 3 },
		createdAt: '2026-03-10T11:00:00Z',
		updatedAt: '2026-03-20T14:00:00Z',
	},

	// --- qa ---
	{
		id: 'wish-012',
		slug: 'caddy-reverse-proxy',
		title: 'Caddy Reverse Proxy Setup',
		summary: 'Configure Caddy for dev.khal.namastex.io with Next.js upstream and WS bridge at /ws/* path.',
		stage: 'qa',
		priority: 'medium',
		assignee: 'Sofia',
		groups: { done: 2, total: 2 },
		createdAt: '2026-03-08T14:00:00Z',
		updatedAt: '2026-03-19T16:00:00Z',
	},

	// --- ship ---
	{
		id: 'wish-013',
		slug: 'nats-jetstream-setup',
		title: 'NATS JetStream Configuration',
		summary: 'Initial NATS server setup with JetStream enabled, localhost-only binding, and PM2 process management.',
		stage: 'ship',
		priority: 'high',
		assignee: 'Gabriel',
		groups: { done: 4, total: 4 },
		createdAt: '2026-03-05T08:00:00Z',
		updatedAt: '2026-03-15T10:00:00Z',
	},
	{
		id: 'wish-014',
		slug: 'qa-browser-monitoring',
		title: 'QA Browser Monitoring',
		summary:
			'Headless Chrome + CDP integration for QA: server logs, browser console, network requests, DOM events, and screenshots.',
		stage: 'ship',
		priority: 'critical',
		assignee: 'Sofia',
		groups: { done: 5, total: 5 },
		createdAt: '2026-03-01T10:00:00Z',
		updatedAt: '2026-03-12T09:00:00Z',
	},
	{
		id: 'wish-015',
		slug: 'window-manager-core',
		title: 'Window Manager Core',
		summary: 'Draggable, resizable, stackable window system with focus management, minimize/maximize, and snap zones.',
		stage: 'ship',
		priority: 'high',
		assignee: 'Gabriel',
		groups: { done: 6, total: 6 },
		createdAt: '2026-02-25T12:00:00Z',
		updatedAt: '2026-03-10T14:00:00Z',
	},
];

export function usePipelineData() {
	const [items, setItems] = useState<PipelineItem[]>(MOCK_ITEMS);

	const refreshData = useCallback(() => {
		// In v2, this will fetch from NATS. For now, reset to mock data.
		setItems([...MOCK_ITEMS]);
	}, []);

	const moveItem = useCallback((itemId: string, toStage: PipelineItem['stage']) => {
		setItems((prev) =>
			prev.map((item) => (item.id === itemId ? { ...item, stage: toStage, updatedAt: new Date().toISOString() } : item))
		);
	}, []);

	return { items, refreshData, moveItem };
}
