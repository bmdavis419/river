import type { CreateRiverStream, RiverStorageProvider, RiverStorageSpecialChunk } from './types.js';

const riverStorageDefaultProvider: RiverStorageProvider<unknown, false> = {
	providerId: 'default',
	isResumable: false,
	init: async ({ streamId, agentRunId }) => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;

		const encoder = new TextEncoder();

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				streamController = controller;

				const initSpecialChunk: RiverStorageSpecialChunk = {
					type: 'river_special',
					data: {
						specialType: 'stream_start',
						agentRunId,
						streamId,
						isResumable: false
					}
				};

				streamController.enqueue(encoder.encode(JSON.stringify(initSpecialChunk)));
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
};

const createRiverStream: CreateRiverStream = (streamId, storage) => {
	return {
		streamId,
		storage
	};
};

export { createRiverStream, riverStorageDefaultProvider };
