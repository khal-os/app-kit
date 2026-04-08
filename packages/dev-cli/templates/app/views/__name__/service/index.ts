import { createService } from '@khal-os/server-sdk/service';
import type { PingRequest, PingResponse } from '../schema';

createService({
	name: '{{name}}-service',
	subscriptions: [
		{
			subject: 'khal.*.{{name}}.ping',
			handler: (msg) => {
				const request = msg.json<PingRequest>();
				const response: PingResponse = {
					pong: true,
					echo: request.message,
					timestamp: Date.now(),
				};
				msg.respond(JSON.stringify(response));
			},
		},
	],
});
