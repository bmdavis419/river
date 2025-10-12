import { ResultAsync } from 'neverthrow';
import { RiverError } from './errors.js';
import type {
	ClientSideCaller,
	ClientSideCallerOptions,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	RiverRouter,
	RiverStorageSpecialChunk
} from './types.js';

type MakeClientSideCaller<Chunk, Input> = (
	options: ClientSideCallerOptions<Chunk>
) => ClientSideCaller<Input>;

type RiverClient<T extends RiverRouter> = {
	[K in keyof T]: MakeClientSideCaller<
		InferRiverStreamChunkType<T[K]>,
		InferRiverStreamInputType<T[K]>
	>;
};

class SvelteKitRiverClientCaller<Chunk, Input> implements ClientSideCaller<Input> {
	status = $state<'idle' | 'canceled' | 'error' | 'success' | 'running'>('idle');
	endpoint: string;
	agentId: string;
	lifeCycleCallbacks: ClientSideCallerOptions<Chunk>;
	currentAbortController: AbortController | null = null;

	private internalFireAgent = async (input: Input, abortController: AbortController) => {
		const { onSuccess, onError, onChunk, onStart, onCancel, onStreamInfo } =
			this.lifeCycleCallbacks;

		await onStart?.();

		this.status = 'running';

		const handleFinish = async (
			args:
				| {
						status: 'success';
				  }
				| {
						status: 'error';
						error: RiverError;
				  }
				| {
						status: 'canceled';
				  }
		) => {
			switch (args.status) {
				case 'success':
					this.status = 'success';
					await onSuccess?.();
					break;
				case 'error':
					this.status = 'error';
					await onError?.(args.error);
					break;
				case 'canceled':
					this.status = 'canceled';
					await onCancel?.();
					break;
			}
		};

		let totalChunks = 0;

		const response = await ResultAsync.fromPromise(
			fetch(this.endpoint, {
				method: 'POST',
				body: JSON.stringify({
					agentId: this.agentId,
					input
				}),
				signal: abortController.signal
			}),

			(error) => {
				return new RiverError('Failed to call agent', error);
			}
		);

		if (response.isErr()) {
			return await handleFinish({ status: 'error', error: response.error });
		}

		if (!response.value.ok) {
			return await handleFinish({
				status: 'error',
				error: new RiverError('Failed to call agent', response.value)
			});
		}

		const reader = response.value.body?.getReader();
		if (!reader) {
			return await handleFinish({
				status: 'error',
				error: new RiverError('Failed to get reader', true)
			});
		}

		const decoder = new TextDecoder();

		let done = false;
		let buffer = '';

		while (!done) {
			const readResult = await ResultAsync.fromPromise(reader.read(), (error) => {
				return new RiverError('Failed to read stream', error);
			});

			if (readResult.isErr()) {
				if (abortController.signal.aborted) {
					await handleFinish({ status: 'canceled' });
					done = true;
					continue;
				}
				await handleFinish({ status: 'error', error: readResult.error });
				done = true;
				continue;
			}

			const { value, done: streamDone } = readResult.value;
			done = streamDone;

			if (!value) continue;

			const decoded = decoder.decode(value, { stream: !done });
			buffer += decoded;

			const messages = buffer.split('\n\n');
			buffer = messages.pop() || '';

			for (const message of messages) {
				if (!message.trim().startsWith('data: ')) continue;

				const rawData = message.replace('data: ', '').trim();

				if (rawData.includes('RIVER_SPECIAL_TYPE_KEY')) {
					const parsed = JSON.parse(rawData) as RiverStorageSpecialChunk;
					if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_start') {
						await onStreamInfo?.({
							runId: parsed.runId,
							streamId: parsed.streamId
						});
					}
					continue;
				}

				let parsed: unknown;
				try {
					parsed = JSON.parse(rawData);
				} catch {
					parsed = rawData;
				}

				await onChunk?.(parsed as any, totalChunks);
				totalChunks += 1;
			}
		}

		if (this.status === 'running') {
			await handleFinish({ status: 'success' });
		}
	};

	start = (input: Input) => {
		this.currentAbortController = new AbortController();
		this.internalFireAgent(input, this.currentAbortController);
	};
	stop = () => {
		this.currentAbortController?.abort();
	};

	constructor(options: ClientSideCallerOptions<Chunk> & { agentId: string; endpoint: string }) {
		this.lifeCycleCallbacks = {
			onSuccess: options.onSuccess,
			onError: options.onError,
			onChunk: options.onChunk,
			onStart: options.onStart,
			onCancel: options.onCancel,
			onStreamInfo: options.onStreamInfo
		};
		this.endpoint = options.endpoint;
		this.agentId = options.agentId;
	}
}

export const createSvelteKitRiverClient = <T extends RiverRouter>(
	endpoint: string
): RiverClient<T> => {
	return new Proxy({} as RiverClient<T>, {
		get: (_target, agentId: string) => {
			return (options: ClientSideCallerOptions<InferRiverStreamChunkType<T[keyof T]>>) => {
				return new SvelteKitRiverClientCaller<
					InferRiverStreamChunkType<T[keyof T]>,
					InferRiverStreamInputType<T[keyof T]>
				>({
					...options,
					agentId,
					endpoint
				});
			};
		}
	});
};
