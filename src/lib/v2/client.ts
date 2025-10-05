// ok in here we need to make the client side caller

import { ResultAsync } from 'neverthrow';
import { RiverError } from './errors.js';
import type { AgentRouter, InferRiverAgentChunkType, InferRiverAgentInputType } from './server.js';

type OnCompleteCallback = (data: { totalChunks: number; duration: number }) => void | Promise<void>;
type OnErrorCallback = (error: RiverError) => void | Promise<void>;
type OnChunkCallback<Chunk> = (chunk: Chunk, index: number) => void | Promise<void>;
type OnStartCallback = () => void | Promise<void>;

type ClientSideCaller<Chunk, Input> = (args: {
	onComplete?: OnCompleteCallback;
	onError?: OnErrorCallback;
	onChunk?: OnChunkCallback<Chunk>;
	onStart?: OnStartCallback;
}) => {
	start: (input: Input) => Promise<void>;
	stop: () => void;
};

export const createRiverClientCaller = <T extends AgentRouter>(): {
	callAgent<K extends keyof T>(
		agentId: K
	): ClientSideCaller<InferRiverAgentChunkType<T[K]>, InferRiverAgentInputType<T[K]>>;
} => {
	return {
		callAgent: (agentId) => {
			return (stuffs) => {
				const { onComplete, onError, onChunk, onStart } = stuffs;

				const abortController = new AbortController();

				type Input = InferRiverAgentInputType<T[keyof T]>;

				const internalCallAgent = async (input: Input) => {
					let totalChunks = 0;
					const startTime = Date.now();

					const handleFinish = async () => {
						await onComplete?.({
							totalChunks,
							duration: Date.now() - startTime
						});
					};

					const response = await ResultAsync.fromPromise(
						fetch('/sandbox/v2', {
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

					await handleFinish();
				};

				return {
					start: async (input) => {
						await onStart?.();
						internalCallAgent(input);
					},
					stop: () => {
						abortController.abort();
					}
				};
			};
		}
	};
};
