import type { RiverStorageProvider, RiverStorageSpecialChunk } from './types.js';

const defaultRiverStorageProvider = <
	ChunkType,
	IsResumable extends boolean
>(): RiverStorageProvider<ChunkType, IsResumable> => ({
	providerId: 'default',
	isResumable: false as IsResumable,
	initStream: async (runId) => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				streamController = controller;
			}
		});

		const encoder = new TextEncoder();

		return {
			stream,
			sendData: (innerSendFunc) => {
				const startChunk: RiverStorageSpecialChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					runId,
					streamId: null
				};

				const sseChunk = `data: ${JSON.stringify(startChunk)}\n\n`;
				streamController.enqueue(encoder.encode(sseChunk));

				innerSendFunc({
					appendChunk: (chunk) => {
						const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
						streamController.enqueue(encoder.encode(sseChunk));
					},
					close: () => {
						const endChunk: RiverStorageSpecialChunk = {
							RIVER_SPECIAL_TYPE_KEY: 'stream_end',
							runId,
							streamId: null
						};

						const sseChunk = `data: ${JSON.stringify(endChunk)}\n\n`;
						streamController.enqueue(encoder.encode(sseChunk));

						streamController.close();
					}
				});
			}
		};
	}
});

export { defaultRiverStorageProvider };
