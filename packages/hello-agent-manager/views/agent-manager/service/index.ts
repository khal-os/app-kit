import type { NatsConnection } from '@khal-os/sdk/service';
import { createService } from '@khal-os/sdk/service';
import { agentProxyHandlers } from './agent-proxy';
import { configStoreHandlers } from './config-store';

createService({
	name: 'hello-agent-manager',
	subscriptions: [...configStoreHandlers, ...agentProxyHandlers],
	onReady: async (_nc: NatsConnection, log) => {
		log.info('hello-agent-manager service ready');
	},
});
