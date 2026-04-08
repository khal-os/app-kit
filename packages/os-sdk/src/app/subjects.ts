/** NATS subject builders for all core KhalOS services. */
export const SUBJECTS = {
	echo: (orgId: string) => `khal.${orgId}.echo`,
	system: {
		health: (orgId: string) => `khal.${orgId}.system.health`,
	},
	pty: {
		create: (orgId: string) => `khal.${orgId}.pty.create`,
		destroy: (orgId: string) => `khal.${orgId}.pty.destroy`,
		list: (orgId: string) => `khal.${orgId}.pty.list`,
		data: (orgId: string, sessionId: string) => `khal.${orgId}.pty.${sessionId}.data`,
		input: (orgId: string, sessionId: string) => `khal.${orgId}.pty.${sessionId}.input`,
		resize: (orgId: string, sessionId: string) => `khal.${orgId}.pty.${sessionId}.resize`,
		exit: (orgId: string, sessionId: string) => `khal.${orgId}.pty.${sessionId}.exit`,
		replay: (orgId: string, sessionId: string) => `khal.${orgId}.pty.${sessionId}.replay`,
		buffer: (orgId: string, sessionId: string) => `khal.${orgId}.pty.${sessionId}.buffer`,
		bufferEnd: (orgId: string, sessionId: string) => `khal.${orgId}.pty.${sessionId}.buffer-end`,
	},
	fs: {
		list: (orgId: string) => `khal.${orgId}.fs.list`,
		read: (orgId: string) => `khal.${orgId}.fs.read`,
		write: (orgId: string) => `khal.${orgId}.fs.write`,
		search: (orgId: string) => `khal.${orgId}.fs.search`,
		watch: (orgId: string, pathHash: string) => `khal.${orgId}.fs.watch.${pathHash}`,
	},
	notify: {
		broadcast: (orgId: string) => `khal.${orgId}.notify.broadcast`,
		user: (orgId: string, userId: string) => `khal.${orgId}.notify.user.${userId}`,
	},
	sandbox: {
		/** Request sandbox creation for a user + app. Payload: { userId, appSlug } */
		create: 'os.sandbox.create',
		/** Request sandbox deletion for a user + app. Payload: { userId, appSlug } */
		delete: 'os.sandbox.delete',
		/** Query sandbox status for a user. Payload: { userId } */
		status: 'os.sandbox.status',
		/** Sandbox lifecycle event stream (provisioning, ready, error, deleted). */
		events: (userId: string) => `os.sandbox.${userId}.events`,
		/** Per-user sandbox PTY subjects — mirrors pty.* but scoped to user's sandbox. */
		pty: {
			create: (orgId: string, userId: string) => `khal.${orgId}.sandbox.${userId}.pty.create`,
			destroy: (orgId: string, userId: string) => `khal.${orgId}.sandbox.${userId}.pty.destroy`,
			list: (orgId: string, userId: string) => `khal.${orgId}.sandbox.${userId}.pty.list`,
			data: (orgId: string, userId: string, sessionId: string) =>
				`khal.${orgId}.sandbox.${userId}.pty.${sessionId}.data`,
			input: (orgId: string, userId: string, sessionId: string) =>
				`khal.${orgId}.sandbox.${userId}.pty.${sessionId}.input`,
			resize: (orgId: string, userId: string, sessionId: string) =>
				`khal.${orgId}.sandbox.${userId}.pty.${sessionId}.resize`,
			exit: (orgId: string, userId: string, sessionId: string) =>
				`khal.${orgId}.sandbox.${userId}.pty.${sessionId}.exit`,
		},
	},
	auth: {
		roleChanged: 'os.auth.role-changed',
		membershipRevoked: 'os.auth.membership-revoked',
	},
	desktop: {
		cmd: {
			open: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.open`,
			close: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.close`,
			focus: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.focus`,
			minimize: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.minimize`,
			maximize: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.maximize`,
			restore: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.restore`,
			notify: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.notify`,
			sync: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.sync`,
			all: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.cmd.>`,
		},
		event: {
			opened: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.opened`,
			closed: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.closed`,
			focused: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.focused`,
			minimized: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.minimized`,
			maximized: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.maximized`,
			restored: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.restored`,
			state: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.state`,
			metaUpdated: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.meta-updated`,
			moved: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.moved`,
			resized: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.resized`,
			all: (orgId: string, userId: string) => `khal.${orgId}.desktop.${userId}.event.>`,
		},
	},
} as const;
