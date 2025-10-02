import { createStreamConsumer } from './consume.js';
import z from 'zod';
import type { SseStream, TextStream } from '$lib/types/index.js';

function createSseStream<Chunk>(data: { chunkSchema: z.ZodType<Chunk> }): SseStream<Chunk> {
	return {
		chunkSchema: data.chunkSchema,
		streamChunkType: 'sse'
	};
}

function createTextStream(): TextStream {
	return {
		chunkSchema: z.string(),
		streamChunkType: 'text'
	};
}

export { createStreamConsumer, createSseStream, createTextStream };
