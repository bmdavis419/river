import { ResultAsync } from 'neverthrow';
import type { RiverStorageProvider, ServerEndpointHandler } from './types.js';
import { RiverError } from './errors.js';

export const createSvelteKitServerEndpointHandler: ServerEndpointHandler = (router) => {
	return {
		POST: async (event) => {
			const abortController = new AbortController();

			event.request.signal.addEventListener(
				'abort',
				() => {
					abortController.abort();
				},
				{ once: true }
			);

			const body = await ResultAsync.fromPromise(
				event.request.json(),
				(e) => new RiverError('Failed to parse request body', { cause: e })
			);

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
				return await provider.initStream(runId);
			};

			// TODO: error handling
			const runResult = await agent.runner({
				initStream,
				runId,
				meta: {
					framework: 'sveltekit',
					event
				},
				abortSignal: abortController.signal,
				input: body.value.input
			});

			return new Response(runResult.stream);
		}
	};
};
