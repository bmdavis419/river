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
				startStreamInBackground: async ({ input, adapterRequest }: any) => {
					const stream = router[routerStreamKey];

					if (!stream) {
						return err(
							new RiverError('Stream not found', undefined, 'internal', {
								routerStreamKey
							})
						);
					}

					return await stream.provider.serverSideRunInBackground({
						input,
						adapterRequest,
						routerStreamKey: routerStreamKey as string,
						runnerFn: stream.runner
					});
				},
				resumeStream: async ({ resumeKey }: any) => {
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

					return await stream.provider.serverSideResumeStream({
						resumptionToken: decodedResumptionTokenResult.value
					});
				},
				startStreamAndConsume: async ({ input, adapterRequest }: any) => {
					const stream = router[routerStreamKey];

					if (!stream) {
						return err(
							new RiverError('Stream not found', undefined, 'internal', {
								routerStreamKey
							})
						);
					}

					return await stream.provider.serverSideRunAndConsume({
						input,
						adapterRequest,
						routerStreamKey: routerStreamKey as string,
						runnerFn: stream.runner
					});
				}
			};
		}
	});
};
