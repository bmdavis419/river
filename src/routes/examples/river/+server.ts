import { RIVER_SERVER } from '$lib/index.js';
import { exampleRouter } from './router.js';

// in the real world this should probably be in src/routes/api/river/+server.ts

export const { POST } = RIVER_SERVER.createServerEndpointHandler(exampleRouter, {
	beforeAgentRun: async ({ event, input, agentId, abortController }) => {
		console.log('[HOOK] - beforeAgentRun', event.route.id, agentId, input);
	},
	afterAgentRun: async ({ event, input, agentId }) => {
		console.log('[HOOK] - afterAgentRun', { agentId });
	},
	onAbort: ({ event, input, agentId, reason }) => {
		console.log('[HOOK] - onAbort', { reason });
	},
	onError: async ({ event, input, agentId, error }) => {
		console.log('[HOOK] - onError', { error });
	}
});
