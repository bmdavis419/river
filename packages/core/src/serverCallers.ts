import { err } from 'neverthrow';
import type {
	InferRiverStreamAdapterRequestType,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	MakeServerSideCaller,
	RiverRouter,
	ServerSideCaller
} from './types';
import { RiverError } from './errors';
import { decodeRiverResumptionToken } from './resumeToken';

export const createServerSideCaller = <T extends RiverRouter>(router: T): ServerSideCaller<T> => {
	return new Proxy({} as ServerSideCaller<T>, {
		get<K extends keyof T>(
			_target: ServerSideCaller<T>,
			routerStreamKey: K & (string | symbol)
		): MakeServerSideCaller<
			InferRiverStreamInputType<T[K]>,
			InferRiverStreamChunkType<T[K]>,
			InferRiverStreamAdapterRequestType<T[K]>
		> {
			return {
				start: async ({ abortController, input, adapterRequest }) => {
					const stream = router[routerStreamKey];

					if (!stream) {
						return err(
							new RiverError('Stream not found', undefined, 'internal', {
								routerStreamKey
							})
						);
					}

					return await stream.provider.startStream({
						abortController,
						input,
						adapterRequest,
						routerStreamKey: routerStreamKey as string,
						runnerFn: stream.runner
					});
				},
				resume: async ({ abortController, resumeKey }) => {
					const stream = router[routerStreamKey];

					const decodedResumptionTokenResult = decodeRiverResumptionToken(resumeKey);

					if (decodedResumptionTokenResult.isErr()) {
						return err(decodedResumptionTokenResult.error);
					}

					if (!stream) {
						return err(
							new RiverError('Stream not found', undefined, 'internal', {
								routerStreamKey
							})
						);
					}

					return await stream.provider.resumeStream({
						abortController,
						resumptionToken: decodedResumptionTokenResult.value
					});
				}
			};
		}
	});
};
