import { error } from '@sveltejs/kit';
import {
	RiverError,
	decodeRiverResumptionToken,
	resumeRiverStreamParamsSchema,
	startRiverStreamBodySchema
} from '@davis7dotsh/river-core';
import type { SvelteKitRiverEndpointHandler } from './types.js';
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

		const resumedStream = await stream.provider.resumeStream({
			abortController,
			resumptionToken: decodedResumptionTokenResult.value
		});

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

		const initStreamResult = await stream.provider.initStream({
			abortController,
			adapterRequest: {
				event
			},
			routerStreamKey,
			input: inputResult.data,
			runnerFn: stream.runner
		});

		if (initStreamResult.isErr()) {
			return error(500, initStreamResult.error);
		}

		return new Response(initStreamResult.value);
	}
});
