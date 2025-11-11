import {
	RiverError,
	createServerSideCaller,
	decodeRiverResumptionToken,
	resumeRiverStreamParamsSchema,
	startRiverStreamBodySchema
} from '@davis7dotsh/river-core';
import { ResultAsync } from 'neverthrow';
import type { TanStackStartRiverEndpointHandler } from './types';

export const riverEndpointHandler: TanStackStartRiverEndpointHandler = (router) => {
	const serverSideCaller = createServerSideCaller(router);
	return {
		GET: async (event) => {
			const searchParams = new URLSearchParams(event.request.url.split('?')[1]);

			const validatedParamsResult = resumeRiverStreamParamsSchema.safeParse(
				Object.fromEntries(searchParams)
			);

			if (!validatedParamsResult.success) {
				const riverError = new RiverError('Must send a resume key', undefined, 'internal');
				return new Response(JSON.stringify(riverError), { status: 400 });
			}

			const decodedResumptionTokenResult = decodeRiverResumptionToken(
				validatedParamsResult.data.resumeKey
			);

			if (decodedResumptionTokenResult.isErr()) {
				return new Response(JSON.stringify(decodedResumptionTokenResult.error), { status: 400 });
			}

			const { routerStreamKey } = decodedResumptionTokenResult.value;

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				abortController.abort();
			});

			const caller = serverSideCaller[routerStreamKey];

			if (!caller) {
				return new Response(
					JSON.stringify(new RiverError('Router stream key not found', undefined, 'internal')),
					{ status: 400 }
				);
			}

			const resumeResult = await caller.resume({
				abortController,
				resumeKey: validatedParamsResult.data.resumeKey
			});

			if (resumeResult.isErr()) {
				return new Response(JSON.stringify(resumeResult.error), { status: 500 });
			}

			const encoder = new TextEncoder();

			const transformResult = resumeResult.value.pipeThrough(
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
		},
		POST: async (event) => {
			const bodyResult = await ResultAsync.fromPromise(
				event.request.json(),
				(e) => new RiverError('Failed to parse request body', e, 'internal')
			);

			if (bodyResult.isErr()) {
				return new Response(JSON.stringify(bodyResult.error), { status: 400 });
			}

			const decodedBodyResult = startRiverStreamBodySchema.safeParse(bodyResult.value);

			if (!decodedBodyResult.success) {
				const riverError = new RiverError('Invalid request body', undefined, 'internal');
				return new Response(JSON.stringify(riverError), { status: 400 });
			}

			const { routerStreamKey, input } = decodedBodyResult.data;

			const abortController = new AbortController();

			event.request.signal.addEventListener('abort', () => {
				abortController.abort();
			});

			const caller = serverSideCaller[routerStreamKey];

			if (!caller) {
				return new Response(
					JSON.stringify(new RiverError('Router stream key not found', undefined, 'internal')),
					{ status: 400 }
				);
			}

			const startResult = await caller.start({
				abortController,
				input: input as any,
				adapterRequest: {
					event
				} as any
			});

			if (startResult.isErr()) {
				return new Response(JSON.stringify(startResult.error), { status: 500 });
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
