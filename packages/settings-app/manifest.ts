export default {
	id: 'settings-app',
	views: [
		{
			id: 'settings',
			label: 'Settings',
			permission: 'settings',
			minRole: 'platform-dev' as const,
			defaultSize: { width: 800, height: 600 },
			component: './views/settings/Settings',
		},
	],
	desktop: {
		icon: '/icons/dusk/system_preferences.svg',
		categories: ['System'],
		comment: 'Desktop settings',
	},
};
