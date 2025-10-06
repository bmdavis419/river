import { RIVER_SERVER, RiverError } from '$lib/index.js';
import { z } from 'zod/mini';
import { exampleRouter } from './router.js';

// in the real world this should probably be in src/routes/api/river/+server.ts

export const { POST } = RIVER_SERVER.createServerEndpointHandler(exampleRouter, {
	beforeAgentRun: {
		try: ({ input, agentId }) => {
			console.log('[HOOK] - beforeAgentRun', { input });
			if (agentId === 'exampleCustomAgent') {
				// With support for type narrowing
				console.log('Narrowed Input', input);
			}
			throw new RiverError('Example Throw');
		},
		catch: (error, { input }) => {
			// Allows for per hook error handling
			console.error('[HOOK ERROR] - beforeAgentRun', error);
		}
	},
	afterAgentRun: async ({ event, input, agentId }) => {
		if (agentId === 'chatAgent') {
			input;
		}
		console.log('[HOOK] - afterAgentRun', { agentId });
	},
	onAbort: ({ event, input, agentId, reason }) => {
		console.log('[HOOK] - onAbort', { reason });
	},
	onError: async ({ event, input, agentId, error }) => {
		console.log('[HOOK] - onError', { error });
	}
});
