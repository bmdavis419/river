import { error } from '@sveltejs/kit';
import { RiverError } from './errors.js';
import {
	resumeRiverStreamParamsSchema,
	startRiverStreamBodySchema,
	type SvelteKitAdapterRequest,
	type SvelteKitRiverEndpointHandler
} from './types.js';
import { decodeRiverResumptionToken } from './resumeTokens.js';
import { ResultAsync } from 'neverthrow';

export const riverEndpointHandler: SvelteKitRiverEndpointHandler = (router) => ({
	GET: async (event) => {
		const { searchParams } = event.url;

		const validatedParamsResult = resumeRiverStreamParamsSchema.safeParse(
			Object.fromEntries(searchParams)
		);

		if (!validatedParamsResult.success) {
			const riverError = new RiverError('Must send a resume key', undefined, 'internal');
			return error(400, riverError);
		}

		const decodedResumptionTokenResult = decodeRiverResumptionToken(
			validatedParamsResult.data.resumeKey
		);

		if (decodedResumptionTokenResult.isErr()) {
			return error(400, decodedResumptionTokenResult.error);
		}

		const { routerStreamKey } = decodedResumptionTokenResult.value;

		const stream = router[routerStreamKey];

		if (!stream) {
			const riverError = new RiverError('Stream not found', undefined, 'internal', {
				routerStreamKey
			});
			return error(500, riverError);
		}

		if (!stream.provider.isResumable) {
			const riverError = new RiverError('Stream is not resumable', undefined, 'internal', {
				routerStreamKey
			});
			return error(500, riverError);
		}

		const abortController = new AbortController();

		event.request.signal.addEventListener('abort', () => {
			abortController.abort();
		});

		const resumedStream = await stream.provider.resumeStream(
			abortController,
			decodedResumptionTokenResult.value
		);

		if (resumedStream.isErr()) {
			return error(500, resumedStream.error);
		}

		return new Response(resumedStream.value);
	},
	POST: async (event) => {
		const bodyResult = await ResultAsync.fromPromise(
			event.request.json(),
			(e) => new RiverError('Failed to parse request body', e, 'internal')
		);

		if (bodyResult.isErr()) {
			return error(400, bodyResult.error);
		}

		const decodedBodyResult = startRiverStreamBodySchema.safeParse(bodyResult.value);

		if (!decodedBodyResult.success) {
			const riverError = new RiverError('Invalid request body', undefined, 'internal');
			return error(400, riverError);
		}

		const { routerStreamKey, input } = decodedBodyResult.data;

		const stream = router[routerStreamKey];

		if (!stream) {
			const riverError = new RiverError('Stream not found', undefined, 'internal', {
				routerStreamKey
			});
			return error(500, riverError);
		}

		const inputResult = stream.inputSchema.safeParse(input);

		if (!inputResult.success) {
			const riverError = new RiverError('Invalid input', undefined, 'internal', {
				routerStreamKey
			});
			return error(400, riverError);
		}

		const abortController = new AbortController();

		event.request.signal.addEventListener('abort', () => {
			abortController.abort();
		});

		const initStreamResult = await stream.provider.initStream(abortController, routerStreamKey);

		if (initStreamResult.isErr()) {
			return error(500, initStreamResult.error);
		}

		const { streamMethods, streamRunId, streamStorageId } = initStreamResult.value;

		const runnerResult = await ResultAsync.fromPromise(
			stream.runner({
				input: inputResult.data,
				streamRunId,
				streamStorageId,
				stream: streamMethods,
				abortSignal: abortController.signal,
				adapterRequest: {
					event
				} as SvelteKitAdapterRequest
			}),
			(e) => new RiverError('Failed to run stream', e, 'stream')
		);

		if (runnerResult.isErr()) {
			return error(500, runnerResult.error);
		}

		return new Response(initStreamResult.value.stream);
	}
});
