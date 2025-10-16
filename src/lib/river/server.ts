import { ResultAsync } from 'neverthrow';
import type { RiverStorageProvider, ServerEndpointHandler } from './types.js';
import { RiverError } from './errors.js';

export const createSvelteKitEndpointHandler: ServerEndpointHandler = (router) => {
	return {
		GET: async (event) => {
			const { searchParams } = event.url;

			const runId = searchParams.get('runId');
			const streamId = searchParams.get('streamId');

			if (!runId || !streamId) {
				return new Response(
					JSON.stringify(
						new RiverError('Run ID and stream ID are required', {
							cause: 'Run ID and stream ID are required'
						})
					),
					{ status: 400 }
				);
			}

			const stream = router[streamId];

			return new Response('Hello, world!');
		},
		POST: async (event) => {
			const body = await ResultAsync.fromPromise(
				event.request.json(),
				(e) => new RiverError('Failed to parse request body', { cause: e })
			);

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				console.log('man please come on please please please');
				abortController.abort();
			});

			if (body.isErr()) {
				return new Response(JSON.stringify(body.error), { status: 400 });
			}

			const streamKey = body.value.streamKey;

			if (!streamKey) {
				return new Response(
					JSON.stringify(
						new RiverError('Stream key is required', { cause: 'Stream key is required' })
					),
					{ status: 400 }
				);
			}

			const stream = router[streamKey];

			if (!stream) {
				return new Response(
					JSON.stringify(new RiverError('Stream not found', { cause: 'Stream not found' })),
					{
						status: 400
					}
				);
			}

			const runId = crypto.randomUUID();

			const initStream = async (provider: RiverStorageProvider<any, any>) => {
				return await provider.initStream(runId, abortController);
			};

			// TODO: error handling
			const runResult = await stream.runner({
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

export const RIVER_SERVERS = { createSvelteKitEndpointHandler };
