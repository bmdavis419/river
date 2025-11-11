import { useState } from 'react';
import type {
	TanStackStartClientSideCaller,
	TanStackStartClientSideCallerOptions,
	TanStackStartRiverClient
} from './types';
import {
	createClientSideCaller,
	RiverError,
	type CallerAsyncIterable,
	type ClientSideCaller,
	type InferRiverStreamChunkType,
	type InferRiverStreamInputType,
	type RiverRouter
} from '@davis7dotsh/river-core';

export const useSampleCounter = () => {
	const [count, setCount] = useState(0);
	const increment = () => setCount(count + 1);
	return { count, increment };
};

const tanstackStartRiverClientCaller = <InputType, ChunkType>(
	options: TanStackStartClientSideCallerOptions<ChunkType>,
	args: {
		caller: ClientSideCaller<any>[number];
	}
): TanStackStartClientSideCaller<InputType, ChunkType> => {
	const caller = args.caller;
	const lifeCycleCallbacks = options;
	let currentAbortController: AbortController | null = null;

	const internalConsumeStream = async (stream: CallerAsyncIterable<unknown>) => {
		let idx = 0;

		for await (const streamItem of stream) {
			switch (streamItem.type) {
				case 'chunk':
					await lifeCycleCallbacks.onChunk?.(streamItem.chunk as ChunkType, idx);
					idx++;
					break;
				case 'special':
					const { special } = streamItem;
					switch (special.RIVER_SPECIAL_TYPE_KEY) {
						case 'stream_start':
							await lifeCycleCallbacks.onInfo?.({
								streamRunId: special.streamRunId,
								encodedResumptionToken: special.encodedResumptionToken
							});
							break;
						case 'stream_error':
							await lifeCycleCallbacks.onError?.(special.error);
							break;
						case 'stream_fatal_error':
							await lifeCycleCallbacks.onFatalError?.(special.error);
							break;
						case 'stream_end':
							await lifeCycleCallbacks.onSuccess?.({
								totalChunks: special.totalChunks,
								totalTimeMs: special.totalTimeMs
							});
							break;
					}
					break;
				case 'aborted':
					await lifeCycleCallbacks.onAbort?.();
					break;
			}
		}
	};

	const internalResumeStream = async (resumeKey: string, abortController: AbortController) => {
		await lifeCycleCallbacks.onStart?.();

		const resumeResult = await caller.resume({ resumeKey, abortController });

		if (resumeResult.isErr()) {
			await lifeCycleCallbacks.onFatalError?.(resumeResult.error);
			return;
		}

		await internalConsumeStream(resumeResult.value);
	};

	const internalFireAgent = async (input: InputType, abortController: AbortController) => {
		await lifeCycleCallbacks.onStart?.();

		const startResult = await caller.start({ input, abortController });

		if (startResult.isErr()) {
			await lifeCycleCallbacks.onFatalError?.(startResult.error);
			return;
		}

		await internalConsumeStream(startResult.value);
	};

	const start = (input: InputType) => {
		currentAbortController?.abort();
		const bigMan = new AbortController();
		currentAbortController = bigMan;
		internalFireAgent(input, bigMan);
	};

	const resume = (resumeKey: string) => {
		currentAbortController?.abort();
		const abortController = new AbortController();
		currentAbortController = abortController;
		internalResumeStream(resumeKey, abortController);
	};

	const abort = () => {
		currentAbortController?.abort();
	};

	return {
		start,
		resume,
		abort
	};
};

export const createRiverClient = <T extends RiverRouter>(
	endpoint: string
): TanStackStartRiverClient<T> => {
	const clientSideCaller = createClientSideCaller<T>(endpoint);

	return new Proxy({} as TanStackStartRiverClient<T>, {
		get<K extends keyof T>(
			_target: TanStackStartRiverClient<T>,
			routerStreamKey: K & (string | symbol)
		) {
			return {
				useStream: (
					options: TanStackStartClientSideCallerOptions<InferRiverStreamChunkType<T[K]>>
				) => {
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
					return tanstackStartRiverClientCaller<
						InferRiverStreamInputType<T[K]>,
						InferRiverStreamChunkType<T[K]>
					>(options, {
						caller
					});
				}
			};
		}
	});
};
