export default {
	id: 'genie-app',
	views: [
		{
			id: 'genie',
			label: 'Genie',
			permission: 'genie',
			minRole: 'platform-dev' as const,
			natsPrefix: 'genie',
			defaultSize: { width: 960, height: 640 },
			component: './views/genie/ui/GenieApp',
		},
		{
			id: 'pipeline',
			label: 'Pipeline',
			permission: 'genie',
			minRole: 'platform-dev' as const,
			natsPrefix: 'genie',
			defaultSize: { width: 1120, height: 700 },
			component: './views/pipeline/ui/PipelineView',
		},
	],
	desktop: {
		icon: '/icons/dusk/electron.svg',
		categories: ['Development'],
		comment: 'Agent mission control',
	},
};
