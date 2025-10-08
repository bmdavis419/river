import type { CreateRiverStream, RiverStorageProvider, RiverStorageSpecialChunk } from './types.js';

const riverStorageDefaultProvider = <ChunkType>(): RiverStorageProvider<ChunkType, false> => ({
	providerId: 'default',
	isResumable: false,
	init: async ({ streamId, agentRunId }) => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;

		const encoder = new TextEncoder();

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				streamController = controller;

				const initSpecialChunk: RiverStorageSpecialChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					agentRunId,
					streamId,
					isResumable: false
				};

				const sseChunk = `data: ${JSON.stringify(initSpecialChunk)}\n\n`;

				streamController.enqueue(encoder.encode(sseChunk));
			}
		});

		return {
			appendChunk: (chunk) => {
				// todo: error handling
				const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
				streamController.enqueue(encoder.encode(sseChunk));
			},
			close: () => {
				streamController.close();
			},
			stream
		};
	}
});

const createRiverStream: CreateRiverStream = (streamId, storage) => {
	return {
		streamId,
		storage
	};
};

export const RIVER_STREAMS = { createRiverStream, riverStorageDefaultProvider };
