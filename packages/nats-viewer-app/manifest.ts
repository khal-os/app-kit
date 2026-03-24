export default {
	id: 'nats-viewer-app',
	views: [
		{
			id: 'nats-viewer',
			label: 'NATS Viewer',
			permission: 'nats-viewer',
			minRole: 'platform-dev' as const,
			defaultSize: { width: 900, height: 600 },
			component: './views/nats-viewer/NatsViewer',
		},
	],
	desktop: {
		icon: '/icons/dusk/activity_monitor.svg',
		categories: ['Development'],
		comment: 'NATS message viewer and debugger',
	},
};
