import type { RequestEvent } from '@sveltejs/kit';
import type z from 'zod';
import type { RiverError } from './errors.js';
import type { AsyncIterableStream, TextStreamPart, Tool, ToolSet } from 'ai';
import type { Result } from 'neverthrow';

// resume tokens

export type RiverResumptionToken = {
	providerId: string;
	streamStorageId: string;
	streamRunId: string;
};

export type DecodeRiverResumptionTokenFunc = (token: string) => RiverResumptionToken;

export type EncodeRiverResumptionTokenFunc = (token: RiverResumptionToken) => string;

// special chunks

export type RiverSpecialStartChunk = {
	RIVER_SPECIAL_TYPE_KEY: 'stream_start';
	streamRunId: string;
	encodedResumptionToken?: string;
};

export type RiverSpecialEndChunk = {
	RIVER_SPECIAL_TYPE_KEY: 'stream_end';
	totalChunks: number;
	totalTimeMs: number;
};

export type RiverSpecialErrorChunk = {
	RIVER_SPECIAL_TYPE_KEY: 'stream_error';
	streamRunId: string;
	error: RiverError;
};

export type RiverSpecialChunk =
	| RiverSpecialStartChunk
	| RiverSpecialEndChunk
	| RiverSpecialErrorChunk;

// river stream providers

type RiverStreamActiveMethods<ChunkType> = {
	appendChunk: (chunk: ChunkType) => Promise<Result<null, RiverError>>;
	appendError: (error: RiverError) => Promise<Result<null, RiverError>>;
	close: () => Promise<Result<null, RiverError>>;
};

export type RiverProvider<IsResumable extends boolean> = {
	providerId: string;
	isResumable: IsResumable;
	resumeStream: (
		abortController: AbortController,
		resumptionToken: RiverResumptionToken
	) => Promise<ReadableStream<Uint8Array>>;
	initStream: (abortController: AbortController) => Promise<RiverStreamActiveMethods<unknown>>;
};

// river streams

export type RiverStream<InputType, ChunkType, IsResumable extends boolean, AdapterRequestType> = {
	_phantom?: {
		inputType: InputType;
		chunkType: ChunkType;
		isResumable: IsResumable;
	};
	inputSchema: z.ZodType<InputType>;
	provider: RiverProvider<IsResumable>;
	runner: RiverStreamRunner<InputType, ChunkType, AdapterRequestType>;
};

type RiverStreamRunner<InputType, ChunkType, AdapterRequestType = null> = (args: {
	input: InputType;
	runId: string;
	stream: RiverStreamActiveMethods<ChunkType>;
	abortSignal: AbortSignal;
	adapterRequest: AdapterRequestType;
}) => Promise<void>;

export type AnyRiverStream = RiverStream<any, any, any, any>;

// river stream builder

type RiverStreamBuilderInputStep<ChunkType = unknown, AdapterRequestType = null> = {
	input: <InputType>(
		inputSchema: z.ZodType<InputType>
	) => RiverStreamBuilderProviderStep<InputType, ChunkType, AdapterRequestType>;
};

type RiverStreamBuilderProviderStep<InputType, ChunkType, AdapterRequestType> = {
	provider: <IsResumable extends boolean>(
		provider: RiverProvider<IsResumable>
	) => RiverStreamBuilderRunnerStep<InputType, ChunkType, IsResumable, AdapterRequestType>;
};

type RiverStreamBuilderRunnerStep<
	InputType,
	ChunkType,
	IsResumable extends boolean,
	AdapterRequestType
> = {
	runner: (
		runner: RiverStreamRunner<InputType, ChunkType, AdapterRequestType>
	) => RiverStream<InputType, ChunkType, IsResumable, AdapterRequestType>;
};

export type CreateRiverStream = <
	ChunkType = unknown,
	AdapterRequestType = null
>() => RiverStreamBuilderInputStep<ChunkType, AdapterRequestType>;

// river router

export type RiverRouter = Record<string, AnyRiverStream>;

export type DecoratedRiverRouter<T extends RiverRouter> = {
	[K in keyof T]: InferRiverStream<T[K]>;
};

export type CreateRiverRouter = <T extends RiverRouter>(streams: T) => DecoratedRiverRouter<T>;

// river adapters
// THESE ARE JUST FOR SVELTEKIT, THESE WILL BE SEPARATED INTO THEIR OWN PACKAGES LATER...

export type SvelteKitAdapterRequest = {
	event: RequestEvent;
};

type ServerEndpointHandler = <T extends RiverRouter>(
	router: DecoratedRiverRouter<T>
) => {
	POST: (event: RequestEvent) => Promise<Response>;
	GET: (event: RequestEvent) => Promise<Response>;
};

// TODO: TO BE UPDATED BELOW...

// HELPERS

type InferRiverStream<T extends AnyRiverStream> =
	T extends RiverStream<
		infer InputType,
		infer ChunkType,
		infer IsResumable,
		infer AdapterRequestType
	>
		? RiverStream<InputType, ChunkType, IsResumable, AdapterRequestType>
		: never;

type InferRiverStreamInputType<T extends AnyRiverStream> =
	T extends RiverStream<infer InputType, any, any, any> ? InputType : never;

type InferRiverStreamChunkType<T extends AnyRiverStream> =
	T extends RiverStream<any, infer ChunkType, any, any> ? ChunkType : never;

type InferRiverStreamIsResumable<T extends AnyRiverStream> =
	T extends RiverStream<any, any, infer IsResumable, any> ? IsResumable : never;

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
