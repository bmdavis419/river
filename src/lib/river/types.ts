import type { RequestEvent } from '@sveltejs/kit';
import type z from 'zod';
import type { RiverError } from './errors.js';
import type { AsyncIterableStream, TextStreamPart, Tool, ToolSet } from 'ai';

type RiverFrameworkMeta =
	| {
			framework: 'sveltekit';
			event: RequestEvent;
	  }
	| {
			framework: 'nextjs';
			req: Request;
	  };

type RiverResumptionToken = {
	providerId: string;
	runId: string;
	streamId: string;
};

type RiverStorageSpecialChunk = {
	RIVER_SPECIAL_TYPE_KEY: 'stream_start' | 'stream_end' | 'stream_error';
	runId: string;
	resumptionToken?: RiverResumptionToken;
	error?: string;
};

type SendDataHelperFunc<ChunkType> = (helpers: {
	appendChunk: (chunk: ChunkType) => Promise<void>;
	close: () => Promise<void>;
}) => Promise<void>;

type RiverStorageActiveStream<ChunkType, IsResumable> = {
	isResumable: IsResumable;
	stream: ReadableStream<Uint8Array>;
	sendData: (func: SendDataHelperFunc<ChunkType>) => void;
};

type RiverStorageProvider<ChunkType, IsResumable> = {
	providerId: string;
	isResumable: IsResumable;
	resumeStream: (
		runId: string,
		abortController: AbortController,
		streamId: string
	) => Promise<ReadableStream<Uint8Array>>;
	initStream: (
		runId: string,
		abortController: AbortController
	) => Promise<RiverStorageActiveStream<ChunkType, IsResumable>>;
};

type RiverStreamRunner<InputType, ChunkType, IsResumable> = (args: {
	input: InputType;
	initStream: (
		streamProvider: RiverStorageProvider<ChunkType, IsResumable>
	) => Promise<RiverStorageActiveStream<ChunkType, IsResumable>>;
	runId: string;
	meta: RiverFrameworkMeta;
	abortSignal: AbortSignal;
}) => Promise<RiverStorageActiveStream<ChunkType, IsResumable>>;

type RiverStream<InputType, ChunkType, IsResumable> = {
	_phantom?: {
		inputType: InputType;
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
	runner: <ChunkType, IsResumable>(
		runnerFn: (args: {
			input: InputType;
			runId: string;
			meta: RiverFrameworkMeta;
			abortSignal: AbortSignal;
			initStream: <C, R>(
				streamProvider: RiverStorageProvider<C, R>
			) => Promise<RiverStorageActiveStream<C, R>>;
		}) => Promise<RiverStorageActiveStream<ChunkType, IsResumable>>
	) => RiverStream<InputType, ChunkType, IsResumable>;
};

type CreateRiverStream = <InputType, ChunkType, IsResumable>() => RiverStreamBuilderInit;

type AnyRiverStream = RiverStream<any, any, any>;

type RiverRouter = Record<string, AnyRiverStream>;

type DecoratedRiverRouter<T extends RiverRouter> = {
	[K in keyof T]: InferRiverStream<T[K]>;
};

type CreateRiverRouter = <T extends RiverRouter>(streams: T) => DecoratedRiverRouter<T>;

type RiverRouterWithProviders<T extends RiverRouter> = {
	streams: DecoratedRiverRouter<T>;
	resumableProviders?: Record<string, RiverStorageProvider<any, any>>;
};

type ServerEndpointHandler = <T extends RiverRouter>(
	router: RiverRouterWithProviders<T>
) => {
	POST: (event: RequestEvent) => Promise<Response>;
	GET: (event: RequestEvent) => Promise<Response>;
};

// HELPERS

type InferRiverStream<T extends AnyRiverStream> =
	T extends RiverStream<infer InputType, infer ChunkType, infer IsResumable>
		? RiverStream<InputType, ChunkType, IsResumable>
		: never;

type InferRiverStreamInputType<T extends AnyRiverStream> =
	T extends RiverStream<infer InputType, any, any> ? InputType : never;

type InferRiverStreamChunkType<T extends AnyRiverStream> =
	T extends RiverStream<any, infer ChunkType, any> ? ChunkType : never;

type InferRiverStreamIsResumable<T extends AnyRiverStream> =
	T extends RiverStream<any, any, infer IsResumable> ? IsResumable : never;

type OnSuccessCallback = () => void | Promise<void>;
type OnErrorCallback = (error: RiverError) => void | Promise<void>;
type OnChunkCallback<Chunk> = (chunk: Chunk, index: number) => void | Promise<void>;
type OnStartCallback = () => void | Promise<void>;
type OnStreamInfoCallback = (data: { runId: string; resumeKey: string }) => void | Promise<void>;
type OnCancelCallback = () => void | Promise<void>;
type OnResetCallback = () => void | Promise<void>;

interface ClientSideCaller<Input, ChunkType> {
	_phantom?: {
		ChunkType: ChunkType;
		InputType: Input;
	};
	status: 'idle' | 'running' | 'canceled' | 'error' | 'success';
	start: (input: Input) => void;
	resume: (resumeKey: string) => void;
	stop: () => void;
	reset: () => void;
}

interface ClientSideCallerOptions<Chunk> {
	onSuccess?: OnSuccessCallback;
	onError?: OnErrorCallback;
	onChunk?: OnChunkCallback<Chunk>;
	onStart?: OnStartCallback;
	onCancel?: OnCancelCallback;
	onStreamInfo?: OnStreamInfoCallback;
	onReset?: OnResetCallback;
}

// AI SDK HELPERS
type RiverAiSdkToolSet<T extends ClientSideCaller<any, TextStreamPart<any>>> =
	T extends ClientSideCaller<any, TextStreamPart<infer Tools>> ? Tools : never;

type RiverAiSdkToolInputType<T extends ToolSet, K extends keyof T> =
	T[K] extends Tool<infer Input> ? Input : never;

type RiverAiSdkToolOutputType<T extends ToolSet, K extends keyof T> =
	T[K] extends Tool<infer _, infer Output> ? Output : never;

// NORMAL HELPERS
type RiverStreamInputType<T extends ClientSideCaller<any, any>> =
	T extends ClientSideCaller<infer Input, any> ? Input : never;
type RiverStreamChunkType<T extends ClientSideCaller<any, any>> =
	T extends ClientSideCaller<any, infer Chunk> ? Chunk : never;

// STREAM SERVER SIDE HELPERS
type InferAiSdkChunkType<T extends AsyncIterableStream<any>> =
	T extends AsyncIterableStream<infer U> ? U : never;

export type {
	CreateRiverStream,
	RiverStreamBuilderInit,
	RiverStreamBuilderRunner,
	CreateRiverRouter,
	ServerEndpointHandler,
	RiverStorageSpecialChunk,
	RiverResumptionToken,
	RiverStorageProvider,
	RiverRouterWithProviders,
	ClientSideCaller,
	ClientSideCallerOptions,
	RiverRouter,
	DecoratedRiverRouter,
	AnyRiverStream,
	InferRiverStream,
	InferRiverStreamInputType,
	InferRiverStreamChunkType,
	InferRiverStreamIsResumable,
	RiverAiSdkToolSet,
	RiverAiSdkToolInputType,
	RiverAiSdkToolOutputType,
	RiverStreamInputType,
	RiverStreamChunkType,
	InferAiSdkChunkType,
	OnResetCallback
};
