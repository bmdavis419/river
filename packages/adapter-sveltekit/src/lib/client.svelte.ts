import { createClientSideCaller, RiverError } from '@davis7dotsh/river-core';
import type {
	CallerAsyncIterable,
	ClientSideCaller,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	RiverRouter
} from '@davis7dotsh/river-core';
import type {
	SvelteKitClientSideCaller,
	SvelteKitClientSideCallerOptions,
	SvelteKitRiverClient
} from './types.js';

class SvelteKitRiverClientCaller<InputType, ChunkType>
	implements SvelteKitClientSideCaller<InputType, ChunkType>
{
	private lifeCycleCallbacks: SvelteKitClientSideCallerOptions<ChunkType>;
	private currentAbortController: AbortController | null = null;
	private caller: ClientSideCaller<any>[number];

	private internalConsumeStream = async (stream: CallerAsyncIterable<unknown>) => {
		let idx = 0;

		for await (const streamItem of stream) {
			switch (streamItem.type) {
				case 'chunk':
					await this.lifeCycleCallbacks.onChunk?.(streamItem.chunk as ChunkType, idx);
					idx++;
					break;
				case 'special':
					const { special } = streamItem;
					switch (special.RIVER_SPECIAL_TYPE_KEY) {
						case 'stream_start':
							await this.lifeCycleCallbacks.onInfo?.({
								streamRunId: special.streamRunId,
								encodedResumptionToken: special.encodedResumptionToken
							});
							break;
						case 'stream_error':
							await this.lifeCycleCallbacks.onError?.(special.error);
							break;
						case 'stream_fatal_error':
							await this.lifeCycleCallbacks.onFatalError?.(special.error);
							break;
						case 'stream_end':
							await this.lifeCycleCallbacks.onSuccess?.({
								totalChunks: special.totalChunks,
								totalTimeMs: special.totalTimeMs
							});
							break;
					}
					break;
				case 'aborted':
					await this.lifeCycleCallbacks.onAbort?.();
					break;
			}
		}
	};

	private internalResumeStream = async (resumeKey: string, abortController: AbortController) => {
		await this.lifeCycleCallbacks.onStart?.();

		const resumeResult = await this.caller.resume({ resumeKey, abortController });

		if (resumeResult.isErr()) {
			await this.lifeCycleCallbacks.onFatalError?.(resumeResult.error);
			return;
		}

		await this.internalConsumeStream(resumeResult.value);
	};

	private internalFireAgent = async (input: InputType, abortController: AbortController) => {
		await this.lifeCycleCallbacks.onStart?.();

		const startResult = await this.caller.start({ input, abortController });

		if (startResult.isErr()) {
			await this.lifeCycleCallbacks.onFatalError?.(startResult.error);
			return;
		}

		await this.internalConsumeStream(startResult.value);
	};

	start = (input: InputType) => {
		this.currentAbortController?.abort();
		const bigMan = new AbortController();
		this.currentAbortController = bigMan;
		this.internalFireAgent(input, bigMan);
	};

	resume = (resumeKey: string) => {
		this.currentAbortController?.abort();
		const abortController = new AbortController();
		this.currentAbortController = abortController;
		this.internalResumeStream(resumeKey, abortController);
	};

	abort = () => {
		this.currentAbortController?.abort();
	};

	constructor(
		options: SvelteKitClientSideCallerOptions<ChunkType>,
		args: {
			caller: ClientSideCaller<any>[number];
		}
	) {
		this.lifeCycleCallbacks = options;
		this.caller = args.caller;
	}
}

export const createRiverClient = <T extends RiverRouter>(
	endpoint: string
): SvelteKitRiverClient<T> => {
	const clientSideCaller = createClientSideCaller<T>(endpoint);
	return new Proxy({} as SvelteKitRiverClient<T>, {
		get<K extends keyof T>(
			_target: SvelteKitRiverClient<T>,
			routerStreamKey: K & (string | symbol)
		) {
			return (options: SvelteKitClientSideCallerOptions<InferRiverStreamChunkType<T[K]>>) => {
				const caller = clientSideCaller[routerStreamKey] as any;
				if (!caller) {
					throw new RiverError(
						'Trying to access a non-existent stream on the client',
						undefined,
						'unknown',
						{
							routerStreamKey
						}
					);
				}
				return new SvelteKitRiverClientCaller<
					InferRiverStreamInputType<T[K]>,
					InferRiverStreamChunkType<T[K]>
				>(options, {
					caller
				});
			};
		}
	});
};
