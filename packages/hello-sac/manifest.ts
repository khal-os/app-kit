const manifest = {
	id: 'hello-sac',
	views: [
		{
			id: 'hello-sac',
			label: 'SAC Co-Pilot',
			permission: 'hello-sac',
			minRole: 'platform-admin' as const,
			natsPrefix: 'hello',
			defaultSize: { width: 1200, height: 800 },
			component: '@khal-os/hello-sac/views/hello-sac',
		},
	],
	desktop: {
		icon: '/icons/dusk/skype.svg',
		categories: ['Voice'],
		comment: 'Outbound voice agent cockpit for SAC operations',
	},
};

export default manifest;
