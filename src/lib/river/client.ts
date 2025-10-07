import { ResultAsync } from 'neverthrow';
import type {
	AgentRouter,
	ClientSideCaller,
	InferRiverAgentChunkType,
	InferRiverAgentInputType
} from './types.js';
import { RiverError, codeFromStatus, RiverErrorJSONSchema } from './errors.js';

type RiverClientCaller<T extends AgentRouter> = {
	[K in keyof T]: ClientSideCaller<InferRiverAgentChunkType<T[K]>, InferRiverAgentInputType<T[K]>>;
};

const createClientCaller = <T extends AgentRouter>(endpoint: string): RiverClientCaller<T> => {
	return new Proxy({} as RiverClientCaller<T>, {
		get: (_target, agentId: string) => {
			return (stuffs: any) => {
				// typescript doesn't need to know about this, types above handle it
				const { onComplete, onError, onChunk, onStart, onCancel } = stuffs;

				type Input = InferRiverAgentInputType<T[keyof T]>;

				// this isn't great, has edge cases when you have multiple agents running (which u really shouldn't be doing), need to fix later
				let currentAbortController: AbortController | null = null;

				const internalCallAgent = async (input: Input, abortController: AbortController) => {
					let totalChunks = 0;
					const startTime = Date.now();

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
							const isAbort = abortController.signal.aborted;
							const message = isAbort ? 'Request was cancelled' : 'Failed to call agent';
							const code: RiverError['code'] = isAbort
								? 'CLIENT_CLOSED_REQUEST'
								: 'INTERNAL_SERVER_ERROR';
							return new RiverError(message, {
								code: code,
								agentId,
								cause: error
							});
						}
					);

					if (response.isErr()) {
						const isAbortErr = response.error.code === 'CLIENT_CLOSED_REQUEST';
						if (isAbortErr || abortController.signal.aborted) {
							await onCancel?.();
							await handleFinish();
							return;
						}
						await onError?.(response.error);
						await handleFinish();
						return;
					}

					if (!response.value.ok) {
						const args = {
							code: codeFromStatus(response.value.status),
							httpStatus: response.value.status,
							agentId
						};
						const riverErr = await ResultAsync.fromPromise(
							response.value.json(),
							(error) => new RiverError('Failed to parse JSON', { cause: error, ...args })
						).match(
							(json) => {
								const { success, data, error } = RiverErrorJSONSchema.safeParse(json);
								return success
									? RiverError.fromJSON(data)
									: new RiverError('Unexpected Error Format', { cause: error, ...args });
							},
							(error) => error
						);

						await onError?.(riverErr);
						await handleFinish();
						return;
					}

					const reader = response.value.body?.getReader();
					if (!reader) {
						await onError?.(
							new RiverError('Failed to get reader', {
								code: 'INTERNAL_SERVER_ERROR',
								agentId
							})
						);
						await handleFinish();
						return;
					}

					const decoder = new TextDecoder();

					let done = false;
					let buffer = '';

					while (!done) {
						const readResult = await ResultAsync.fromPromise(reader.read(), (error) => {
							return new RiverError('Failed to read stream', {
								code: 'INTERNAL_SERVER_ERROR',
								cause: error
							});
						});

						if (readResult.isErr()) {
							if (abortController.signal.aborted) {
								await onCancel?.();
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
							const lines = message.split('\n');
							let eventType: string | null = null;
							let dataPayload = '';

							for (const rawLine of lines) {
								const line = rawLine.trim();
								if (!line) continue;
								if (line.startsWith('event:')) {
									eventType = line.slice('event:'.length).trim();
								} else if (line.startsWith('data:')) {
									dataPayload += line.slice('data:'.length).trim();
								}
							}

							if (eventType === 'error') {
								const result = RiverErrorJSONSchema.safeParse(dataPayload);
								const riverErr = result.success
									? RiverError.fromJSON(result.data)
									: new RiverError('Stream error', {
											code: 'INTERNAL_SERVER_ERROR',
											cause: dataPayload,
											agentId
										});

								await onError?.(riverErr);

								await reader.cancel();
								abortController.abort();

								done = true;
								break;
							}

							if (!dataPayload) continue;
							let parsed: unknown;
							try {
								parsed = JSON.parse(dataPayload);
							} catch {
								parsed = dataPayload;
							}
							await onChunk?.(parsed as any, totalChunks);
							totalChunks += 1;
						}
					}

					await handleFinish();
				};

				return {
					// typescript doesn't need to know about this, types above handle it
					start: async (input: any) => {
						currentAbortController = new AbortController();
						await onStart?.();
						internalCallAgent(input, currentAbortController);
					},
					stop: () => {
						currentAbortController?.abort();
					}
				};
			};
		}
	});
};

export const RIVER_CLIENT = {
	createClientCaller
};
