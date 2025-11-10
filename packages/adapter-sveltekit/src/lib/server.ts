import { error } from '@sveltejs/kit';
import {
	RiverError,
	createServerSideCaller,
	decodeRiverResumptionToken,
	resumeRiverStreamParamsSchema,
	startRiverStreamBodySchema
} from '@davis7dotsh/river-core';
import type { SvelteKitRiverEndpointHandler } from './types.js';
import { ResultAsync } from 'neverthrow';

export const riverEndpointHandler: SvelteKitRiverEndpointHandler = (router) => {
	const serverSideCaller = createServerSideCaller(router);
	return {
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

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				abortController.abort();
			});

			const resumeResult = await serverSideCaller[routerStreamKey].resume({
				abortController,
				resumeKey: validatedParamsResult.data.resumeKey
			});

			if (resumeResult.isErr()) {
				return error(500, resumeResult.error);
			}

			const encoder = new TextEncoder();

			const transformResult = resumeResult.value.pipeThrough(
				new TransformStream({
					transform(chunk, controller) {
						console.log('TRANSFORMING CHUNK', chunk);
						let sseChunk: string;
						try {
							sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
						} catch {
							sseChunk = `data: ${chunk}\n\n`;
						}
						controller.enqueue(encoder.encode(sseChunk));
					}
				})
			);

			return new Response(transformResult);
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

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				abortController.abort();
			});

			const startResult = await serverSideCaller[routerStreamKey].start({
				abortController,
				input: input as any,
				adapterRequest: {
					event
				} as any
			});

			if (startResult.isErr()) {
				return error(500, startResult.error);
			}

			const encoder = new TextEncoder();

			const transformResult = startResult.value.pipeThrough(
				new TransformStream({
					transform(chunk, controller) {
						let sseChunk: string;
						try {
							sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
						} catch {
							sseChunk = `data: ${chunk}\n\n`;
						}
						controller.enqueue(encoder.encode(sseChunk));
					}
				})
			);

			return new Response(transformResult);
		}
	};
};
