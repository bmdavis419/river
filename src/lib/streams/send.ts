import { StreamError } from '$lib/errors/index.js';
import type { CreateStreamSender } from '$lib/types/index.js';
import { ok, Result, ResultAsync } from 'neverthrow';

const createStreamSender: CreateStreamSender = (stream) => {
	let controller: ReadableStreamDefaultController<Uint8Array>;
	const encoder = new TextEncoder();

	const readableStream = new ReadableStream<Uint8Array>({
		start(ctrl) {
			controller = ctrl;
		}
	});

	const stringifyChunk = (chunk: unknown) => {
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

		return textChunk;
	};

	return {
		stream: readableStream,
		pipeIn: (externalStream) => {
			return ResultAsync.fromThrowable(
				async () => {
					const reader = externalStream.getReader();
					let done = false;
					while (!done) {
						const { value, done: streamDone } = await reader.read();
						done = streamDone;
						if (!value) continue;
						const stringChunk = stringifyChunk(value);
						controller.enqueue(encoder.encode(stringChunk));
					}
					reader.cancel();
				},
				(error) => {
					return new StreamError(
						`Failed to pipe in stream: ${error instanceof Error ? error.message : String(error)}`,
						true
					);
				}
			)();
		},
		append: (chunk) => {
			return Result.fromThrowable(
				() => {
					const textChunk = stringifyChunk(chunk);

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
