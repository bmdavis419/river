import { ResultAsync } from 'neverthrow';
import type { RiverStorageProvider, ServerEndpointHandler } from './types.js';
import { RiverError } from './errors.js';

export const createSvelteKitServerEndpointHandler: ServerEndpointHandler = (router) => {
	return {
		POST: async (event) => {
			const body = await ResultAsync.fromPromise(
				event.request.json(),
				(e) => new RiverError('Failed to parse request body', { cause: e })
			);

			console.log('YOU ARE HERE RIGHT????', event.request.signal);

			event.request.signal.addEventListener('abort', () => {
				console.log('man please come on please please please');
			});

			await new Promise((resolve) => setTimeout(resolve, 10000));

			if (body.isErr()) {
				return new Response(JSON.stringify(body.error), { status: 400 });
			}

			const agentId = body.value.agentId;

			if (!agentId) {
				return new Response(
					JSON.stringify(new RiverError('Agent ID is required', { cause: 'Agent ID is required' })),
					{ status: 400 }
				);
			}

			const agent = router[agentId];

			if (!agent) {
				return new Response(
					JSON.stringify(new RiverError('Agent not found', { cause: 'Agent not found' })),
					{
						status: 400
					}
				);
			}

			const runId = crypto.randomUUID();

			const initStream = async (provider: RiverStorageProvider<any, any>) => {
				return await provider.initStream(runId, event.request.signal);
			};

			// TODO: error handling
			const runResult = await agent.runner({
				initStream,
				runId,
				meta: {
					framework: 'sveltekit',
					event
				},
				abortSignal: event.request.signal,
				input: body.value.input
			});

			return new Response(runResult.stream);
		}
	};
};
