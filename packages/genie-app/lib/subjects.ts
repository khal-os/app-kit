const PREFIX = 'os.genie';

export const SUBJECTS = {
	// --- Existing: Agent listing & pane control ---
	agents: {
		list: () => `${PREFIX}.agents.list`,
	},
	sessions: {
		list: () => `${PREFIX}.sessions.list`,
	},
	pane: {
		capture: (paneId: string) => `${PREFIX}.pane.${paneId}.capture`,
		send: (paneId: string) => `${PREFIX}.pane.${paneId}.send`,
	},
	spawn: () => `${PREFIX}.spawn`,
	events: {
		state: () => `${PREFIX}.events.state`,
	},
	// Terminal proxy — PTY attached to a tmux pane
	term: {
		create: () => `${PREFIX}.term.create`,
		destroy: () => `${PREFIX}.term.destroy`,
		data: (sessionId: string) => `${PREFIX}.term.${sessionId}.data`,
		input: (sessionId: string) => `${PREFIX}.term.${sessionId}.input`,
		resize: (sessionId: string) => `${PREFIX}.term.${sessionId}.resize`,
		exit: (sessionId: string) => `${PREFIX}.term.${sessionId}.exit`,
		replay: (sessionId: string) => `${PREFIX}.term.${sessionId}.replay`,
		buffer: (sessionId: string) => `${PREFIX}.term.${sessionId}.buffer`,
		bufferEnd: (sessionId: string) => `${PREFIX}.term.${sessionId}.buffer-end`,
	},

	// --- Teams domain ---
	teams: {
		list: () => `${PREFIX}.teams.list`,
		get: () => `${PREFIX}.teams.get`,
		create: () => `${PREFIX}.teams.create`,
		disband: () => `${PREFIX}.teams.disband`,
		done: () => `${PREFIX}.teams.done`,
		blocked: () => `${PREFIX}.teams.blocked`,
		hire: () => `${PREFIX}.teams.hire`,
		fire: () => `${PREFIX}.teams.fire`,
	},

	// --- Communication domain ---
	comms: {
		send: () => `${PREFIX}.comms.send`,
		broadcast: () => `${PREFIX}.comms.broadcast`,
		inbox: () => `${PREFIX}.comms.inbox`,
		chat: {
			post: () => `${PREFIX}.comms.chat.post`,
			read: () => `${PREFIX}.comms.chat.read`,
		},
	},

	// --- Wishes / Work domain ---
	wish: {
		list: () => `${PREFIX}.wish.list`,
		status: () => `${PREFIX}.wish.status`,
		work: () => `${PREFIX}.wish.work`,
		done: () => `${PREFIX}.wish.done`,
		reset: () => `${PREFIX}.wish.reset`,
	},

	// --- Agent lifecycle domain ---
	agent: {
		kill: () => `${PREFIX}.agent.kill`,
		stop: () => `${PREFIX}.agent.stop`,
		history: () => `${PREFIX}.agent.history`,
		answer: () => `${PREFIX}.agent.answer`,
		read: () => `${PREFIX}.agent.read`,
	},

	// --- Agent directory domain ---
	dir: {
		list: () => `${PREFIX}.dir.list`,
		get: () => `${PREFIX}.dir.get`,
		add: () => `${PREFIX}.dir.add`,
		remove: () => `${PREFIX}.dir.remove`,
		edit: () => `${PREFIX}.dir.edit`,
	},

	// --- Ideas domain (thin layer over tasks) ---
	ideas: {
		add: () => `${PREFIX}.ideas.add`,
		list: () => `${PREFIX}.ideas.list`,
		vote: () => `${PREFIX}.ideas.vote`,
		promote: () => `${PREFIX}.ideas.promote`,
		archive: () => `${PREFIX}.ideas.archive`,
	},

	// --- Tasks domain ---
	task: {
		list: () => `${PREFIX}.task.list`,
		show: () => `${PREFIX}.task.show`,
		move: () => `${PREFIX}.task.move`,
		create: () => `${PREFIX}.task.create`,
		done: () => `${PREFIX}.task.done`,
	},

	// --- Projects domain ---
	project: {
		list: () => `${PREFIX}.project.list`,
	},

	// --- Apps domain ---
	apps: {
		list: () => `${PREFIX}.apps.list`,
		get: () => `${PREFIX}.apps.get`,
		register: () => `${PREFIX}.apps.register`,
		unregister: () => `${PREFIX}.apps.unregister`,
		store: {
			list: () => `${PREFIX}.apps.store.list`,
			submit: () => `${PREFIX}.apps.store.submit`,
			approve: () => `${PREFIX}.apps.store.approve`,
		},
		run: {
			start: () => `${PREFIX}.apps.run.start`,
			end: () => `${PREFIX}.apps.run.end`,
			list: () => `${PREFIX}.apps.run.list`,
		},
		vote: () => `${PREFIX}.apps.vote`,
		unvote: () => `${PREFIX}.apps.unvote`,
		metrics: () => `${PREFIX}.apps.metrics`,
	},

	// --- System health ---
	system: {
		doctor: () => `${PREFIX}.system.doctor`,
		version: () => `${PREFIX}.system.version`,
	},
} as const;
