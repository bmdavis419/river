import { ResultAsync } from 'neverthrow';
import type {
	AgentRouter,
	ClientSideCaller,
	InferRiverAgentChunkType,
	InferRiverAgentInputType
} from './types.js';
import { RiverError } from './errors.js';

const createClientCaller = <T extends AgentRouter>(
	endpoint: string
): {
	agent<K extends keyof T>(
		agentId: K
	): {
		makeCaller: ClientSideCaller<InferRiverAgentChunkType<T[K]>, InferRiverAgentInputType<T[K]>>;
	};
} => {
	return {
		agent: (agentId) => {
			return {
				makeCaller: (stuffs) => {
					const { onComplete, onError, onChunk, onStart, onCancel } = stuffs;

					type Input = InferRiverAgentInputType<T[keyof T]>;

					// this isn't great, has edge cases when you have multiple agents running (which u really shouldn't be doing), need to fix later
					let currentAbortController: AbortController | null = null;

					const internalCallAgent = async (input: Input, abortController: AbortController) => {
						let totalChunks = 0;
						const startTime = Date.now();
						let didCancel = false;

						const handleFinish = async () => {
							await onComplete?.({
								totalChunks,
								duration: Date.now() - startTime
							});
						};

						const response = await ResultAsync.fromPromise(
							fetch(endpoint, {
								method: 'POST',
								body: JSON.stringify({
									agentId,
									input
								}),
								signal: abortController.signal
							}),
							(error) => {
								return new RiverError('Failed to call agent', error);
							}
						);

						if (response.isErr()) {
							await onError?.(response.error);
							await handleFinish();
							return;
						}

						if (!response.value.ok) {
							await onError?.(new RiverError('Failed to call agent', response.value));
							await handleFinish();
							return;
						}

						const reader = response.value.body?.getReader();
						if (!reader) {
							await onError?.(new RiverError('Failed to get reader', true));
							await handleFinish();
							return;
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
									await onCancel?.();
									didCancel = true;
									done = true;
									continue;
								}
								await onError?.(readResult.error);
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

						if (!didCancel) {
							await handleFinish();
						}
					};

					return {
						start: async (input) => {
							currentAbortController = new AbortController();
							await onStart?.();
							internalCallAgent(input, currentAbortController);
						},
						stop: () => {
							currentAbortController?.abort();
						}
					};
				}
			};
		}
	};
};

export const RIVER_CLIENT = {
	createClientCaller
};
