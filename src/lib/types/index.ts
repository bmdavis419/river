import type { StreamError } from '$lib/errors/index.js';
import type z from 'zod';

type SseStream<Chunk> = {
	streamChunkType: 'sse';
	chunkSchema: z.ZodType<Chunk>;
};

type TextStream = {
	streamChunkType: 'text';
	chunkSchema: z.ZodType<string>;
};

type Stream<Chunk> = SseStream<Chunk> | TextStream;

type CreateStreamSender = <Chunk>() => {};

type OnCompleteCallback = (data: {
	totalChunks: number;
	totalBytes: number;
	duration: number;
	didFatalError: boolean;
}) => void | Promise<void>;
type OnErrorCallback = (error: StreamError) => void | Promise<void>;
type OnChunkCallback<Chunk> = (chunk: Chunk, index: number) => void | Promise<void>;
type OnStartCallback = () => void | Promise<void>;

type CreateStreamConsumer = <Chunk>(
	stream: Stream<Chunk>,
	args?: {
		onComplete?: OnCompleteCallback;
		onError?: OnErrorCallback;
		onChunk?: OnChunkCallback<Chunk>;
		onStart?: OnStartCallback;
	}
) => {
	start: (url: string) => void;
	stop: () => void;
};

export type { CreateStreamConsumer, SseStream, TextStream, Stream };
