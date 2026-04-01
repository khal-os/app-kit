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
	services: [
		{
			name: 'genie-control',
			entry: './views/genie/service/index.ts',
			runtime: 'node',
			health: { type: 'tcp', target: 4222, interval: 30000, timeout: 5000 },
		},
	],
	desktop: {
		icon: '/icons/dusk/electron.svg',
		categories: ['Development'],
		comment: 'Agent mission control',
	},
};
