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
				const error = new RiverError('Resume key is required', undefined, 'custom');
				return new Response(JSON.stringify(error.toJSON()), { status: 500 });
			}

			let resumptionToken;
			try {
				const decodedStr = atob(resumptionTokenStr);
				resumptionToken = JSON.parse(decodedStr);
			} catch (error) {
				const riverError = new RiverError('Invalid resume key', error, 'custom');
				return new Response(JSON.stringify(riverError.toJSON()), { status: 500 });
			}

			const { providerId, runId, streamId } = resumptionToken;

			if (!resumableProviders || !resumableProviders[providerId]) {
				const error = new RiverError('Provider not found', undefined, 'custom', { providerId });
				return new Response(JSON.stringify(error.toJSON()), { status: 500 });
			}

			const provider = resumableProviders[providerId];

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				abortController.abort();
			});

			try {
				const resumedStream = await provider.resumeStream(runId, abortController, streamId);
				return new Response(resumedStream);
			} catch (error) {
				const riverError =
					error instanceof RiverError
						? error
						: new RiverError('Failed to resume stream', error, 'stream', { runId, providerId });
				console.error(`[${runId}] error resuming stream:`, riverError);
				return new Response(JSON.stringify(riverError.toJSON()), { status: 500 });
			}
		},
		POST: async (event) => {
			const body = await ResultAsync.fromPromise(
				event.request.json(),
				(e) => new RiverError('Failed to parse request body', e, 'custom')
			);

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				abortController.abort();
			});

			if (body.isErr()) {
				return new Response(JSON.stringify(body.error.toJSON()), { status: 500 });
			}

			const streamKey = body.value.streamKey;

			if (!streamKey) {
				const error = new RiverError('Stream key is required', undefined, 'custom');
				return new Response(JSON.stringify(error.toJSON()), { status: 500 });
			}

			const stream = streams[streamKey];

			if (!stream) {
				const error = new RiverError('Stream not found', undefined, 'custom', { streamKey });
				return new Response(JSON.stringify(error.toJSON()), { status: 500 });
			}

			const runId = crypto.randomUUID();

			const initStream = async (provider: RiverStorageProvider<any, any>) => {
				return await provider.initStream(runId, abortController);
			};

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
