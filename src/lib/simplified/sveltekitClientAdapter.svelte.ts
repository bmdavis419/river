import { ResultAsync } from 'neverthrow';
import { RiverError } from './errors.js';
import type {
	ClientSideCaller,
	ClientSideCallerOptions,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	RiverRouter,
	RiverSpecialChunk,
	SvelteKitRiverClient
} from './types.js';

// life cycle callback flow:

class SvelteKitRiverClientCaller<InputType, ChunkType>
	implements ClientSideCaller<InputType, ChunkType>
{
	status = $state<'not_started' | 'running' | 'aborted' | 'error' | 'finished'>('not_started');
	endpoint: string;
	routerStreamKey: string;
	lifeCycleCallbacks: ClientSideCallerOptions<ChunkType>;
	currentAbortController: AbortController | null = null;

	private handleFinish = async (
		args:
			| {
					status: 'finished';
					data: {
						totalChunks: number;
						totalTimeMs: number;
					};
			  }
			| {
					status: 'error';
					error: RiverError;
			  }
			| {
					status: 'aborted';
			  }
	) => {
		switch (args.status) {
			case 'finished':
				this.status = 'finished';
				await this.lifeCycleCallbacks.onEnd?.(args.data);
				break;
			case 'error':
				this.status = 'error';
				await this.lifeCycleCallbacks.onError?.(args.error);
				break;
			case 'aborted':
				this.status = 'aborted';
				await this.lifeCycleCallbacks.onAbort?.();
				break;
		}
	};

	private internalConsumeStream = async (
		reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
		abortController: AbortController
	) => {
		const decoder = new TextDecoder();

		let done = false;
		let buffer = '';

		let totalChunks = 0;

		while (!done) {
			const readResult = await ResultAsync.fromPromise(reader.read(), (error) => {
				return new RiverError('Failed to read stream', error);
			});

			if (readResult.isErr()) {
				if (abortController.signal.aborted) {
					await this.handleFinish({ status: 'aborted' });
					done = true;
					continue;
				}
				await this.handleFinish({ status: 'error', error: readResult.error });
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
					const parsed = JSON.parse(rawData) as RiverSpecialChunk;
					if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_start') {
						await this.lifeCycleCallbacks.onStreamInfo?.({
							streamRunId: parsed.streamRunId,
							encodedResumptionToken: parsed.encodedResumptionToken
						});
					} else if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_error') {
						let riverError: RiverError;
						if (parsed.error) {
							try {
								riverError = RiverError.fromJSON(parsed.error);
							} catch {
								riverError = new RiverError('Stream error');
							}
						} else {
							riverError = new RiverError('Stream error');
						}
						await this.handleFinish({ status: 'error', error: riverError });
						done = true;
						break;
					} else if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_end') {
						await this.handleFinish({
							status: 'finished',
							data: {
								totalChunks: parsed.totalChunks,
								totalTimeMs: parsed.totalTimeMs
							}
						});
						done = true;
						break;
					}
					continue;
				}

				let parsed: unknown;
				try {
					parsed = JSON.parse(rawData);
				} catch {
					parsed = rawData;
				}

				await this.lifeCycleCallbacks.onChunk?.(parsed as any, totalChunks);
				totalChunks += 1;
			}
		}

		if (this.status === 'running') {
			await this.handleFinish({ status: 'finished', data: { totalChunks, totalTimeMs: 0 } });
		}
	};

	private internalResumeStream = async (resumeKey: string, abortController: AbortController) => {
		await this.lifeCycleCallbacks.onStart?.();

		this.status = 'running';

		const response = await ResultAsync.fromPromise(
			fetch(`${this.endpoint}?resumeKey=${encodeURIComponent(resumeKey)}`, {
				method: 'GET',
				signal: abortController.signal
			}),

			(error) => {
				return new RiverError('Failed to resume stream', error);
			}
		);

		if (response.isErr()) {
			return await this.handleFinish({ status: 'error', error: response.error });
		}

		if (!response.value.ok) {
			let riverError: RiverError;
			try {
				const errorData = await response.value.json();
				riverError = RiverError.fromJSON(errorData);
			} catch {
				riverError = new RiverError('Failed to resume stream', response.value);
			}
			return await this.handleFinish({
				status: 'error',
				error: riverError
			});
		}

		const reader = response.value.body?.getReader();
		if (!reader) {
			return await this.handleFinish({
				status: 'error',
				error: new RiverError('Failed to get reader')
			});
		}

		await this.internalConsumeStream(reader, abortController);
	};

	private internalFireAgent = async (input: InputType, abortController: AbortController) => {
		await this.lifeCycleCallbacks.onStart?.();

		this.status = 'running';

		const response = await ResultAsync.fromPromise(
			fetch(this.endpoint, {
				method: 'POST',
				body: JSON.stringify({
					routerStreamKey: this.routerStreamKey,
					input
				}),
				signal: abortController.signal
			}),

			(error) => {
				return new RiverError('Failed to call agent', error);
			}
		);

		if (response.isErr()) {
			return await this.handleFinish({ status: 'error', error: response.error });
		}

		if (!response.value.ok) {
			let riverError: RiverError;
			try {
				const errorData = await response.value.json();
				riverError = RiverError.fromJSON(errorData);
			} catch {
				riverError = new RiverError('Failed to call agent', response.value);
			}
			return await this.handleFinish({
				status: 'error',
				error: riverError
			});
		}

		const reader = response.value.body?.getReader();
		if (!reader) {
			return await this.handleFinish({
				status: 'error',
				error: new RiverError('Failed to get reader')
			});
		}

		await this.internalConsumeStream(reader, abortController);
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
		options: ClientSideCallerOptions<ChunkType> & { routerStreamKey: string; endpoint: string }
	) {
		this.lifeCycleCallbacks = {
			onEnd: options.onEnd,
			onError: options.onError,
			onChunk: options.onChunk,
			onStart: options.onStart,
			onAbort: options.onAbort,
			onStreamInfo: options.onStreamInfo
		};
		this.endpoint = options.endpoint;
		this.routerStreamKey = options.routerStreamKey;
	}
}

export const createRiverClient = <T extends RiverRouter>(
	endpoint: string
): SvelteKitRiverClient<T> => {
	return new Proxy({} as SvelteKitRiverClient<T>, {
		get<K extends keyof T>(
			_target: SvelteKitRiverClient<T>,
			routerStreamKey: K & (string | symbol)
		) {
			return (options: ClientSideCallerOptions<InferRiverStreamChunkType<T[K]>>) => {
				return new SvelteKitRiverClientCaller<
					InferRiverStreamInputType<T[K]>,
					InferRiverStreamChunkType<T[K]>
				>({
					...options,
					routerStreamKey: routerStreamKey as string,
					endpoint
				});
			};
		}
	});
};
