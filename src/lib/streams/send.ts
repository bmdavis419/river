import { StreamError } from '$lib/errors/index.js';
import type { CreateStreamSender } from '$lib/types/index.js';
import { Result } from 'neverthrow';

const createStreamSender: CreateStreamSender = (stream) => {
	let controller: ReadableStreamDefaultController<Uint8Array>;
	const encoder = new TextEncoder();

	const readableStream = new ReadableStream<Uint8Array>({
		start(ctrl) {
			controller = ctrl;
		}
	});

	return {
		stream: readableStream,
		append: (chunk) => {
			return Result.fromThrowable(
				() => {
					let textChunk: string;

					if (stream.streamChunkType === 'sse') {
						const validationResult = stream.chunkSchema.safeParse(chunk);
						if (!validationResult.success) {
							throw new Error(`Invalid chunk format: ${validationResult.error.message}`);
						}
						textChunk = `data: ${JSON.stringify(chunk)}\n\n`;
					} else {
						const validationResult = stream.chunkSchema.safeParse(chunk);
						if (!validationResult.success) {
							throw new Error(`Invalid chunk format: ${validationResult.error.message}`);
						}
						textChunk = chunk as string;
					}

					const encodedChunk = encoder.encode(textChunk);
					controller.enqueue(encodedChunk);
				},
				(error) => {
					return new StreamError(
						`Failed to append chunk: ${error instanceof Error ? error.message : String(error)}`,
						false
					);
				}
			)();
		},
		close: () => {
			controller.close();
		}
	};
};

export { createStreamSender };
