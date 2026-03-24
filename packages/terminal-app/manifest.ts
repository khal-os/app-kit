export default {
	id: 'terminal-app',
	views: [
		{
			id: 'terminal',
			label: 'Terminal',
			permission: 'terminal',
			minRole: 'platform-dev' as const,
			natsPrefix: 'pty',
			defaultSize: { width: 720, height: 480 },
			fullSizeContent: true,
			component: './views/terminal/ui/MultiTerminalApp',
		},
	],
	desktop: {
		icon: '/icons/dusk/terminal.svg',
		categories: ['System'],
		comment: 'Terminal emulator',
	},
};
