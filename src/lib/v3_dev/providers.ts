import type { RiverStorageProvider, RiverStorageSpecialChunk } from './types.js';

const defaultRiverStorageProvider = <
	ChunkType,
	IsResumable extends boolean
>(): RiverStorageProvider<ChunkType, IsResumable> => ({
	providerId: 'default',
	isResumable: false as IsResumable,
	initStream: async (runId, abortSignal) => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				streamController = controller;
			}
		});

		const encoder = new TextEncoder();

		const safeSendChunk = (chunk: any) => {
			console.log('TRYING TO SEND CHUNK', chunk, abortSignal.aborted);
			if (abortSignal.aborted) {
				return;
			}
			try {
				const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
				streamController.enqueue(encoder.encode(sseChunk));
			} catch (error) {
				console.error('failed to send chunk', error);
			}
		};

		return {
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

						streamController.close();
					}
				});
			}
		};
	}
});

export { defaultRiverStorageProvider };
