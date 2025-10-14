import type { RiverStorageProvider, RiverStorageSpecialChunk } from './types.js';

const defaultRiverStorageProvider = <ChunkType>(): RiverStorageProvider<ChunkType, false> => ({
	providerId: 'default',
	isResumable: false,
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
					close: () => {
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

export { defaultRiverStorageProvider };
