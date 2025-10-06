import { RIVER_SERVER, RiverError } from '$lib/index.js';
import { exampleRouter } from './router.js';

// in the real world this should probably be in src/routes/api/river/+server.ts

export const { POST } = RIVER_SERVER.createServerEndpointHandler(exampleRouter, {
	beforeAgentRun: {
		try: ({ input }) => {
			console.log('[HOOK] - beforeAgentRun', { input });
			throw new RiverError('Example Throw');
		},
		catch: (error, { input }) => {
			// Allows for per hook error handling
			console.error('[HOOK ERROR] - beforeAgentRun', error);
		}
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
