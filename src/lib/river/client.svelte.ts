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

type MakeClientSideCaller<Input, Chunk> = (
	options: ClientSideCallerOptions<Chunk>
) => ClientSideCaller<Input, Chunk>;

type RiverClient<T extends RiverRouter> = {
	[K in keyof T]: MakeClientSideCaller<
		InferRiverStreamInputType<T[K]>,
		InferRiverStreamChunkType<T[K]>
	>;
};

class SvelteKitRiverClientCaller<Input, Chunk> implements ClientSideCaller<Input, Chunk> {
	status = $state<'idle' | 'canceled' | 'error' | 'success' | 'running'>('idle');
	endpoint: string;
	streamKey: string;
	lifeCycleCallbacks: ClientSideCallerOptions<Chunk>;
	currentAbortController: AbortController | null = null;

	private internalResumeStream = async (resumeKey: string, abortController: AbortController) => {
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
			fetch(`${this.endpoint}?resumeKey=${encodeURIComponent(resumeKey)}`, {
				method: 'GET',
				signal: abortController.signal
			}),

			(error) => {
				return new RiverError('Failed to resume stream', error);
			}
		);

		if (response.isErr()) {
			return await handleFinish({ status: 'error', error: response.error });
		}

		if (!response.value.ok) {
			let riverError: RiverError;
			try {
				const errorData = await response.value.json();
				riverError = RiverError.fromJSON(errorData);
			} catch {
				riverError = new RiverError('Failed to resume stream', response.value);
			}
			return await handleFinish({
				status: 'error',
				error: riverError
			});
		}

		const reader = response.value.body?.getReader();
		if (!reader) {
			return await handleFinish({
				status: 'error',
				error: new RiverError('Failed to get reader')
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
						let resumeKeyForCallback = '';
						if (parsed.resumptionToken) {
							resumeKeyForCallback = btoa(JSON.stringify(parsed.resumptionToken));
						}
						await onStreamInfo?.({
							runId: parsed.runId,
							resumeKey: resumeKeyForCallback
						});
					} else if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_error') {
						let riverError: RiverError;
						if (parsed.error) {
							try {
								const errorData = JSON.parse(parsed.error);
								riverError = RiverError.fromJSON(errorData);
							} catch {
								riverError = new RiverError('Stream error');
							}
						} else {
							riverError = new RiverError('Stream error');
						}
						await handleFinish({ status: 'error', error: riverError });
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

				await onChunk?.(parsed as any, totalChunks);
				totalChunks += 1;
			}
		}

		if (this.status === 'running') {
			await handleFinish({ status: 'success' });
		}
	};

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
					streamKey: this.streamKey,
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
			let riverError: RiverError;
			try {
				const errorData = await response.value.json();
				riverError = RiverError.fromJSON(errorData);
			} catch {
				riverError = new RiverError('Failed to call agent', response.value);
			}
			return await handleFinish({
				status: 'error',
				error: riverError
			});
		}

		const reader = response.value.body?.getReader();
		if (!reader) {
			return await handleFinish({
				status: 'error',
				error: new RiverError('Failed to get reader')
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
						let resumeKey = '';
						if (parsed.resumptionToken) {
							resumeKey = btoa(JSON.stringify(parsed.resumptionToken));
						}
						await onStreamInfo?.({
							runId: parsed.runId,
							resumeKey
						});
					} else if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_error') {
						let riverError: RiverError;
						if (parsed.error) {
							try {
								const errorData = JSON.parse(parsed.error);
								riverError = RiverError.fromJSON(errorData);
							} catch {
								riverError = new RiverError('Stream error');
							}
						} else {
							riverError = new RiverError('Stream error');
						}
						await handleFinish({ status: 'error', error: riverError });
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

				await onChunk?.(parsed as any, totalChunks);
				totalChunks += 1;
			}
		}

		if (this.status === 'running') {
			await handleFinish({ status: 'success' });
		}
	};

	start = (input: Input) => {
		const bigMan = new AbortController();
		this.currentAbortController = bigMan;
		this.internalFireAgent(input, bigMan);
	};

	resume = (resumeKey: string) => {
		const abortController = new AbortController();
		this.currentAbortController = abortController;
		this.internalResumeStream(resumeKey, abortController);
	};

	stop = () => {
		this.currentAbortController?.abort();
	};

	reset = () => {
		this.currentAbortController?.abort();
		this.status = 'idle';
		this.currentAbortController = null;
		this.lifeCycleCallbacks.onReset?.();
	};

	constructor(options: ClientSideCallerOptions<Chunk> & { streamKey: string; endpoint: string }) {
		this.lifeCycleCallbacks = {
			onSuccess: options.onSuccess,
			onError: options.onError,
			onChunk: options.onChunk,
			onStart: options.onStart,
			onCancel: options.onCancel,
			onStreamInfo: options.onStreamInfo,
			onReset: options.onReset
		};
		this.endpoint = options.endpoint;
		this.streamKey = options.streamKey;
	}
}

const createSvelteKitRiverClient = <T extends RiverRouter>(endpoint: string): RiverClient<T> => {
	return new Proxy({} as RiverClient<T>, {
		get<K extends keyof T>(_target: RiverClient<T>, streamKey: K & (string | symbol)) {
			return (options: ClientSideCallerOptions<InferRiverStreamChunkType<T[K]>>) => {
				return new SvelteKitRiverClientCaller<
					InferRiverStreamInputType<T[K]>,
					InferRiverStreamChunkType<T[K]>
				>({
					...options,
					streamKey: streamKey as string,
					endpoint
				});
			};
		}
	});
};

export const RIVER_CLIENT_SVELTEKIT = { createSvelteKitRiverClient };
