export default {
	id: 'files-app',
	views: [
		{
			id: 'files',
			label: 'Files',
			permission: 'files',
			minRole: 'member' as const,
			natsPrefix: 'fs',
			defaultSize: { width: 800, height: 600 },
			component: './views/files/FilesApp',
		},
	],
	desktop: {
		icon: '/icons/dusk/finder.svg',
		categories: ['System'],
		comment: 'File browser',
	},
};
