export default {
	id: 'hello-console',
	views: [
		{
			id: 'console',
			label: 'Voice Console',
			permission: 'hello-console',
			minRole: 'platform-admin' as const,
			natsPrefix: 'hello',
			defaultSize: { width: 1100, height: 700 },
			component: './views/console/Console',
		},
	],
	desktop: {
		icon: '/icons/dusk/activity_monitor.svg',
		categories: ['Development'],
		comment: 'Monitor HELLO voice agents in real-time',
	},
};
