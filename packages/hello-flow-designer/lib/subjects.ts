/** NATS subject constants for the flow designer service */
export const FLOW_SUBJECTS = {
	SAVE: 'hello.flows.save',
	LOAD: 'hello.flows.load',
	LIST: 'hello.flows.list',
	DELETE: 'hello.flows.delete',
	EXPORT: 'hello.flows.export',
} as const;
