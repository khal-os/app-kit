export default {
	id: '{{packageName}}',
	views: [
		{
			id: '{{name}}',
			label: '{{label}}',
			permission: '{{name}}',
			minRole: 'member' as const,
			natsPrefix: '{{name}}',
			defaultSize: { width: 800, height: 600 },
			component: './views/{{name}}/ui/App',
		},
	],
	desktop: {
		icon: '/icons/dusk/app.svg',
		categories: ['Utilities'],
		comment: '{{description}}',
	},
};
