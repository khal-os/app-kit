export default {
	id: 'hello-flow-designer',
	views: [
		{
			id: 'flow-designer',
			label: 'Flow Designer',
			permission: 'hello-flows',
			minRole: 'platform-dev' as const,
			natsPrefix: 'hello.flows',
			defaultSize: { width: 1200, height: 800 },
			component: './views/flow-designer/ui/FlowDesignerApp',
		},
	],
	desktop: {
		icon: '/icons/dusk/electron.svg',
		categories: ['Development'],
		comment: 'Visual voice agent flow builder',
	},
};
