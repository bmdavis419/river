import { ResultAsync } from 'neverthrow';
import type { RiverStorageProvider, ServerEndpointHandler } from './types.js';
import { RiverError } from './errors.js';

export const createSvelteKitEndpointHandler: ServerEndpointHandler = ({
	streams,
	resumableProviders
}) => {
	return {
		GET: async (event) => {
			const { searchParams } = event.url;

			const resumptionTokenStr = searchParams.get('resumeKey');

			if (!resumptionTokenStr) {
				return new Response(
					JSON.stringify(
						new RiverError('Resume key is required', {
							cause: 'Resume key is required'
						})
					),
					{ status: 400 }
				);
			}

			let resumptionToken;
			try {
				const decodedStr = atob(resumptionTokenStr);
				resumptionToken = JSON.parse(decodedStr);
			} catch {
				return new Response(
					JSON.stringify(
						new RiverError('Invalid resume key', {
							cause: 'Invalid resume key'
						})
					),
					{ status: 400 }
				);
			}

			const { providerId, runId, streamId } = resumptionToken;

			if (!resumableProviders || !resumableProviders[providerId]) {
				return new Response(
					JSON.stringify(new RiverError('Provider not found', { cause: 'Provider not found' })),
					{ status: 400 }
				);
			}

			const provider = resumableProviders[providerId];

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				abortController.abort();
			});

			// TODO: error handling
			const resumedStream = await provider.resumeStream(runId, abortController, streamId);

			return new Response(resumedStream);
		},
		POST: async (event) => {
			const body = await ResultAsync.fromPromise(
				event.request.json(),
				(e) => new RiverError('Failed to parse request body', { cause: e })
			);

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
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

			const stream = streams[streamKey];

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
