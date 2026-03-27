export default {
	id: 'hello-agent-manager',
	views: [
		{
			id: 'agent-manager',
			label: 'Agent Manager',
			permission: 'hello-agent-manager',
			minRole: 'platform-admin' as const,
			natsPrefix: 'hello',
			defaultSize: { width: 960, height: 640 },
			component: './views/agent-manager/AgentManager',
		},
	],
	desktop: {
		icon: '/icons/dusk/automator.svg',
		categories: ['Development'],
		comment: 'Manage HELLO voice agents',
	},
};
