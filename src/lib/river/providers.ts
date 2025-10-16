import { S2Core } from '@s2-dev/streamstore/core.js';
import type { RiverStorageProvider, RiverStorageSpecialChunk } from './types.js';
import { streamsCreateStream } from '@s2-dev/streamstore/funcs/streamsCreateStream.js';
import { recordsAppend } from '@s2-dev/streamstore/funcs/recordsAppend.js';
import { recordsRead } from '@s2-dev/streamstore/funcs/recordsRead.js';
import { ResultAsync } from 'neverthrow';
import { RiverError } from './errors.js';

const defaultRiverStorageProvider = <ChunkType>(): RiverStorageProvider<ChunkType, false> => ({
	providerId: 'default',
	isResumable: false,
	resumeStream: async (runId, abortController) => {
		return new ReadableStream<Uint8Array>({
			start(controller) {
				controller.close();
			}
		});
	},
	initStream: async (runId, abortController) => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				streamController = controller;
			},
			cancel(reason) {
				abortController.abort(reason);
			}
		});

		const encoder = new TextEncoder();

		const safeSendChunk = (chunk: any) => {
			try {
				if (!abortController.signal.aborted) {
					const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
					streamController.enqueue(encoder.encode(sseChunk));
				}
			} catch (error) {
				console.error('failed to send chunk', error);
			}
		};

		return {
			isResumable: false,
			stream,
			sendData: (innerSendFunc) => {
				const startChunk: RiverStorageSpecialChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					runId
				};

				safeSendChunk(startChunk);

				ResultAsync.fromPromise(
					innerSendFunc({
						appendChunk: (chunk) => {
							safeSendChunk(chunk);
						},
						close: async () => {
							const endChunk: RiverStorageSpecialChunk = {
								RIVER_SPECIAL_TYPE_KEY: 'stream_end',
								runId
							};

							safeSendChunk(endChunk);

							if (!abortController.signal.aborted) {
								streamController.close();
							}
						}
					}),
					(error) =>
						error instanceof RiverError
							? error
							: new RiverError('Error in stream handler', error, 'stream', { runId })
				).then((result) => {
					if (result.isErr()) {
						console.error(`[${runId}] error in stream handler:`, result.error);
						const errorChunk: RiverStorageSpecialChunk = {
							RIVER_SPECIAL_TYPE_KEY: 'stream_error',
							runId,
							error: JSON.stringify(result.error.toJSON())
						};
						safeSendChunk(errorChunk);
						if (!abortController.signal.aborted) {
							streamController.close();
						}
					}
				});
			}
		};
	}
});

const s2RiverStorageProvider = <ChunkType>(
	accessToken: string,
	streamId?: string,
	waitUntil?: (promise: Promise<unknown>) => void | undefined
): RiverStorageProvider<ChunkType, true> => ({
	providerId: 's2',
	isResumable: true,
	resumeStream: async (runId, abortController, s2StreamId) => {
		const s2 = new S2Core({
			accessToken
		});

		let streamController: ReadableStreamDefaultController<Uint8Array>;
		let reader: ReadableStreamDefaultReader<any> | null = null;

		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				streamController = controller;

				if (abortController.signal.aborted) {
					controller.close();
					return;
				}

				const result = await ResultAsync.fromPromise(
					recordsRead(
						s2,
						{
							stream: runId,
							s2Basin: s2StreamId,
							seqNum: 0
						},
						{
							signal: abortController.signal,
							headers: {
								Accept: 'text/event-stream'
							}
						}
					),
					(error) =>
						new RiverError(`Failed to read records from S2: ${error}`, error, 'storage', {
							runId,
							s2StreamId
						})
				);

				if (result.isErr()) {
					console.error(`[${runId}] error reading records from S2:`, result.error);
					controller.error(result.error);
					return;
				}

				const recordsReadResult = result.value;
				if (recordsReadResult.error) {
					const error = new RiverError(
						`S2 returned error: ${recordsReadResult.error.message}`,
						recordsReadResult.error,
						'storage',
						{ runId, s2StreamId }
					);
					console.error(`[${runId}] ${error.message}`);
					controller.error(error);
					return;
				}

				if (!(recordsReadResult.value instanceof ReadableStream)) {
					const error = new RiverError('S2 did not return a stream', undefined, 'storage', {
						runId,
						s2StreamId
					});
					console.error(`[${runId}] ${error.message}`);
					controller.error(error);
					return;
				}

				const externalStream = recordsReadResult.value;
				reader = externalStream.getReader();
				const encoder = new TextEncoder();

				let shouldContinue = true;

				try {
					while (shouldContinue && !abortController.signal.aborted) {
						const { done, value } = await reader.read();

						if (done) {
							console.log(`[${runId}] S2 stream ended`);
							shouldContinue = false;
							break;
						}

						if (value.event === 'batch' && value.data?.records) {
							const records = value.data.records;

							for (const record of records) {
								if (!abortController.signal.aborted) {
									const sseData = `data: ${record.body}\n\n`;
									streamController.enqueue(encoder.encode(sseData));

									try {
										const parsedRecord = JSON.parse(record.body);
										if (parsedRecord.RIVER_SPECIAL_TYPE_KEY === 'stream_end') {
											shouldContinue = false;
											break;
										}
									} catch {}
								}
							}
						}
					}
				} catch (error) {
					if (error instanceof Error && error.name === 'AbortError') {
						console.log(`[${runId}] resume stream aborted by client`);
					} else if (error instanceof RiverError) {
						console.error(`[${runId}] error during resume stream:`, error);
						if (!abortController.signal.aborted) {
							controller.error(error);
						}
					} else {
						const riverError = new RiverError('Error during resume stream', error, 'stream', {
							runId
						});
						console.error(`[${runId}] error during resume stream:`, riverError);
						if (!abortController.signal.aborted) {
							controller.error(riverError);
						}
					}
				} finally {
					if (reader) {
						const cancelResult = await ResultAsync.fromPromise(
							reader.cancel(),
							(error) =>
								new RiverError(`Failed to cancel reader: ${error}`, error, 'stream', { runId })
						);

						if (cancelResult.isErr()) {
							console.log(`[${runId}] error cancelling reader:`, cancelResult.error);
						}
					}
					if (!abortController.signal.aborted) {
						streamController.close();
					}
				}
			},
			cancel(reason) {
				console.log(`[${runId}] resume stream cancelled by client`, reason);
				abortController.abort(reason);
			}
		});

		return stream;
	},
	initStream: async (runId, abortController) => {
		if (!streamId) {
			throw new RiverError('s2StreamId is required for S2 resumable streams', undefined, 'custom', {
				runId
			});
		}

		if (!waitUntil) {
			throw new RiverError('waitUntil is required for S2 resumable streams', undefined, 'custom', {
				runId
			});
		}

		let streamController: ReadableStreamDefaultController<Uint8Array>;

		const s2 = new S2Core({
			accessToken
		});

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				streamController = controller;
			},
			cancel(reason) {
				abortController.abort(reason);
			}
		});

		const createStreamResult = await ResultAsync.fromPromise(
			streamsCreateStream(s2, {
				s2Basin: streamId,
				createStreamRequest: {
					stream: runId
				}
			}),
			(error) =>
				new RiverError(`Failed to create stream: ${error}`, error, 'storage', { runId, streamId })
		);

		if (createStreamResult.isErr()) {
			throw createStreamResult.error;
		}

		const s2StreamResult = createStreamResult.value;
		if (s2StreamResult.error) {
			throw new RiverError(s2StreamResult.error.message, s2StreamResult.error, 'storage', {
				runId,
				streamId
			});
		}

		let pendingRecords: Array<{ body: string }> = [];
		let currentAppendPromise: Promise<void> | null = null;
		const encoder = new TextEncoder();

		const flushRecords = async (): Promise<{ isOk: boolean; error?: RiverError }> => {
			if (pendingRecords.length === 0) return { isOk: true };

			const recordsToFlush = pendingRecords;
			pendingRecords = [];

			const result = await ResultAsync.fromPromise(
				recordsAppend(s2, {
					s2Basin: streamId,
					stream: s2StreamResult.value.name,
					appendInput: {
						records: recordsToFlush
					}
				}),
				(error) =>
					new RiverError(`Failed to append records to S2: ${error}`, error, 'storage', {
						runId,
						streamId
					})
			);

			if (result.isErr()) {
				console.error(`[${s2StreamResult.value.name}] error appending records:`, result.error);
				return { isOk: false, error: result.error };
			}

			const s2Result = result.value;
			if (s2Result.error) {
				const error = new RiverError(s2Result.error.message, s2Result.error, 'storage', {
					runId,
					streamId
				});
				console.error(`[${s2StreamResult.value.name}] error appending records:`, error);
				return { isOk: false, error };
			}

			return { isOk: true };
		};

		const safeSendChunk = (chunk: any) => {
			try {
				const stringifiedChunk = JSON.stringify(chunk);
				const sseChunk = `data: ${stringifiedChunk}\n\n`;

				pendingRecords.push({ body: stringifiedChunk });

				if (!abortController.signal.aborted) {
					streamController.enqueue(encoder.encode(sseChunk));
				}

				if (currentAppendPromise === null) {
					currentAppendPromise = flushRecords()
						.then((result) => {
							currentAppendPromise = null;
							if (!result.isOk) {
								console.error(`[${runId}] error flushing records:`, result.error);
								if (!abortController.signal.aborted) {
									streamController.error(result.error);
								}
							}
						})
						.catch((error) => {
							currentAppendPromise = null;
							const riverError =
								error instanceof RiverError
									? error
									: new RiverError('Unexpected error flushing records', error, 'stream', { runId });
							console.error(`[${runId}] unexpected error flushing records:`, riverError);
							if (!abortController.signal.aborted) {
								streamController.error(riverError);
							}
						});
				}
			} catch (error) {
				const riverError =
					error instanceof RiverError
						? error
						: new RiverError('Error sending chunk', error, 'stream', { runId });
				console.error(`[${runId}] error sending chunk:`, riverError);
				if (!abortController.signal.aborted) {
					streamController.error(riverError);
				}
			}
		};

		return {
			isResumable: true,
			stream,
			sendData: (innerSendFunc) => {
				const resumptionToken = {
					providerId: 's2',
					runId,
					streamId
				};

				const startChunk: RiverStorageSpecialChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					runId,
					resumptionToken
				};

				safeSendChunk(startChunk);

				const sendDataPromise = ResultAsync.fromPromise(
					innerSendFunc({
						appendChunk: (chunk) => {
							safeSendChunk(chunk);
						},
						close: async () => {
							try {
								if (currentAppendPromise) {
									await currentAppendPromise;
								}

								const endChunk: RiverStorageSpecialChunk = {
									RIVER_SPECIAL_TYPE_KEY: 'stream_end',
									runId
								};

								pendingRecords.push({ body: JSON.stringify(endChunk) });

								const flushResult = await flushRecords();

								if (!flushResult.isOk) {
									console.error(`[${runId}] error flushing final records:`, flushResult.error);
									if (!abortController.signal.aborted) {
										streamController.error(flushResult.error);
									}
									return;
								}

								if (!abortController.signal.aborted) {
									const sseChunk = `data: ${JSON.stringify(endChunk)}\n\n`;
									streamController.enqueue(encoder.encode(sseChunk));
									streamController.close();
								}
							} catch (error) {
								const riverError =
									error instanceof RiverError
										? error
										: new RiverError('Error closing stream', error, 'stream', { runId });
								console.error(`[${runId}] error closing stream:`, riverError);
								if (!abortController.signal.aborted) {
									streamController.error(riverError);
								}
							}
						}
					}),
					(error) =>
						error instanceof RiverError
							? error
							: new RiverError('Error in stream handler', error, 'stream', { runId })
				).then((result) => {
					if (result.isErr()) {
						console.error(`[${runId}] error in stream handler:`, result.error);
						const errorChunk: RiverStorageSpecialChunk = {
							RIVER_SPECIAL_TYPE_KEY: 'stream_error',
							runId,
							error: JSON.stringify(result.error.toJSON())
						};
						safeSendChunk(errorChunk);
						if (!abortController.signal.aborted) {
							streamController.close();
						}
					}
				});

				waitUntil(Promise.resolve(sendDataPromise));
			}
		};
	}
});

export const RIVER_PROVIDERS = { defaultRiverStorageProvider, s2RiverStorageProvider };
