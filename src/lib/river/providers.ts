import { S2Core } from '@s2-dev/streamstore/core.js';
import type { RiverStorageProvider, RiverStorageSpecialChunk } from './types.js';
import { streamsCreateStream } from '@s2-dev/streamstore/funcs/streamsCreateStream.js';
import { recordsAppend } from '@s2-dev/streamstore/funcs/recordsAppend.js';

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
					runId,
					streamId: null
				};

				safeSendChunk(startChunk);

				innerSendFunc({
					appendChunk: (chunk) => {
						safeSendChunk(chunk);
					},
					close: async () => {
						const endChunk: RiverStorageSpecialChunk = {
							RIVER_SPECIAL_TYPE_KEY: 'stream_end',
							runId,
							streamId: null
						};

						safeSendChunk(endChunk);

						if (!abortController.signal.aborted) {
							streamController.close();
						}
					}
				});
			}
		};
	}
});

// TODO: the beginnings of the resumable streams, has a lot of work to do...

const s2RiverStorageProvider = <ChunkType>(
	streamId: string,
	accessToken: string
): RiverStorageProvider<ChunkType, true> => ({
	providerId: 's2',
	isResumable: true,
	resumeStream: async (runId, abortController) => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;
		return new ReadableStream<Uint8Array>({
			start(controller) {
				controller.close();
			}
		});
	},
	initStream: async (runId, abortController) => {
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

		const s2Stream = await streamsCreateStream(s2, {
			s2Basin: streamId,
			createStreamRequest: {
				stream: runId
			}
		});

		if (s2Stream.error) {
			throw new Error(s2Stream.error.message);
		}

		let pendingRecords: Array<{ body: string }> = [];
		let currentAppendPromise: Promise<any> | null = null;
		const encoder = new TextEncoder();

		const flushRecords = async () => {
			if (pendingRecords.length === 0) return;

			const recordsToFlush = pendingRecords;
			pendingRecords = [];

			try {
				await recordsAppend(s2, {
					s2Basin: streamId,
					stream: s2Stream.value.name,
					appendInput: {
						records: recordsToFlush
					}
				});
			} catch (error) {
				console.error(`[${s2Stream.value.name}] Failed to append records to S2:`, error);
			}
		};

		const safeSendChunk = (chunk: any) => {
			if (abortController.signal.aborted) {
				return;
			}
			const stringifiedChunk = JSON.stringify(chunk);
			const sseChunk = `data: ${stringifiedChunk}\n\n`;

			pendingRecords.push({ body: stringifiedChunk });
			streamController.enqueue(encoder.encode(sseChunk));

			if (currentAppendPromise === null) {
				currentAppendPromise = flushRecords().finally(() => {
					currentAppendPromise = null;
				});
			}
		};

		return {
			isResumable: true,
			stream,
			sendData: (innerSendFunc) => {
				const startChunk: RiverStorageSpecialChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					runId,
					streamId
				};

				safeSendChunk(startChunk);

				innerSendFunc({
					appendChunk: (chunk) => {
						safeSendChunk(chunk);
					},
					close: async () => {
						const endChunk: RiverStorageSpecialChunk = {
							RIVER_SPECIAL_TYPE_KEY: 'stream_end',
							runId,
							streamId
						};

						pendingRecords.push({ body: JSON.stringify(endChunk) });

						if (currentAppendPromise) {
							await currentAppendPromise;
						}
						if (pendingRecords.length > 0) {
							await flushRecords();
						}

						if (!abortController.signal.aborted) {
							const sseChunk = `data: ${JSON.stringify(endChunk)}\n\n`;
							streamController.enqueue(encoder.encode(sseChunk));
							streamController.close();
						}
					}
				});
			}
		};
	}
});

export const RIVER_PROVIDERS = { defaultRiverStorageProvider, s2RiverStorageProvider };
