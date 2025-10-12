import type { RequestEvent } from '@sveltejs/kit';
import type z from 'zod';

type RiverFrameworkMeta =
	| {
			framework: 'sveltekit';
			event: RequestEvent;
	  }
	| {
			framework: 'nextjs';
			req: Request;
	  };

type RiverStorageSpecialChunk = {
	RIVER_SPECIAL_TYPE_KEY: 'stream_start' | 'stream_end';
	runId: string;
	streamId: string | null;
};

type SendDataHelperFunc<ChunkType> = (helpers: {
	appendChunk: (chunk: ChunkType) => void;
	close: () => void;
}) => Promise<void> | void;

type RiverStorageActiveStream<ChunkType> = {
	stream: ReadableStream<Uint8Array>;
	sendData: (func: SendDataHelperFunc<ChunkType>) => void;
};

type RiverStorageProvider<ChunkType, IsResumable> = {
	providerId: string;
	isResumable: IsResumable;
	initStream: (runId: string) => Promise<RiverStorageActiveStream<ChunkType>>;
};

type RiverStreamRunner<InputType, ChunkType, IsResumable> = (args: {
	input: InputType;
	initStream: (
		streamProvider: RiverStorageProvider<ChunkType, IsResumable>
	) => Promise<RiverStorageActiveStream<ChunkType>>;
	runId: string;
	meta: RiverFrameworkMeta;
	abortSignal: AbortSignal;
}) => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>;

type RiverStream<InputType, ChunkType, IsResumable> = {
	_phantom?: {
		chunkType: ChunkType;
		isResumable: IsResumable;
	};
	inputSchema: z.ZodType<InputType>;
	runner: RiverStreamRunner<InputType, ChunkType, IsResumable>;
};

// NEW BUILDER STUFF
type RiverStreamBuilderInit = {
	input: <InputType>(inputSchema: z.ZodType<InputType>) => RiverStreamBuilderRunner<InputType>;
};

type RiverStreamBuilderRunner<InputType> = {
	runner: <ChunkType, IsResumable extends boolean>(
		runnerFn: (args: {
			input: InputType;
			runId: string;
			meta: RiverFrameworkMeta;
			abortSignal: AbortSignal;
			initStream: <C, R extends boolean>(
				streamProvider: RiverStorageProvider<C, R>
			) => Promise<RiverStorageActiveStream<C>>;
		}) => Promise<RiverStorageActiveStream<ChunkType>>
	) => RiverStream<InputType, ChunkType, IsResumable>;
};

type CreateRiverStream = <InputType, ChunkType, IsResumable>() => RiverStreamBuilderInit;

type AnyRiverStream = RiverStream<any, any, any>;

type RiverRouter = Record<string, AnyRiverStream>;

type DecoratedRiverRouter<T extends RiverRouter> = {
	[K in keyof T]: InferRiverStream<T[K]>;
};

type CreateRiverRouter = <T extends RiverRouter>(streams: T) => DecoratedRiverRouter<T>;

type ServerEndpointHandler = <T extends RiverRouter>(
	router: DecoratedRiverRouter<T>
) => { POST: (event: RequestEvent) => Promise<Response> };

// HELPERS

type InferRiverStream<T extends AnyRiverStream> =
	T extends RiverStream<infer InputType, infer ChunkType, infer IsResumable>
		? RiverStream<InputType, ChunkType, IsResumable>
		: never;

export type {
	CreateRiverStream,
	RiverStreamBuilderInit,
	RiverStreamBuilderRunner,
	CreateRiverRouter,
	ServerEndpointHandler,
	RiverStorageSpecialChunk,
	RiverStorageProvider
};
