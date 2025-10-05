// ok in here we need to make the client side caller

import type { AgentRouter, InferRiverAgentChunkType, InferRiverAgentInputType } from './server.js';

type OnCompleteCallback = (data: { totalChunks: number; duration: number }) => void | Promise<void>;
type OnErrorCallback = (error: unknown) => void | Promise<void>;
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

					const response = await fetch('/sandbox/v2', {
						method: 'POST',
						body: JSON.stringify({
							agentId,
							input
						})
					});

					if (!response.ok) {
						await onError?.(new Error('Failed to call agent'));
						await handleFinish();
						return;
					}

					const reader = response.body?.getReader();
					if (!reader) {
						await onError?.(new Error('Failed to get reader'));
						await handleFinish();
						return;
					}

					const decoder = new TextDecoder();

					let done = false;
					let buffer = '';

					while (!done) {
						const readResult = await reader.read();

						const { value, done: streamDone } = readResult;
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
						console.log('stop');
					}
				};
			};
		}
	};
};
