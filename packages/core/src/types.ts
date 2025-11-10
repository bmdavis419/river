import type { RiverError } from './errors';
import type { Result } from 'neverthrow';
import type { z } from 'zod';

// resume tokens

export type RiverResumptionToken = {
	providerId: string;
	routerStreamKey: string;
	streamStorageId: string;
	streamRunId: string;
};

export type DecodeRiverResumptionTokenFunc = (
	token: string
) => Result<RiverResumptionToken, RiverError>;

export type EncodeRiverResumptionTokenFunc = (
	token: RiverResumptionToken
) => Result<string, RiverError>;

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
	error: RiverError;
};

export type RiverSpecialFatalErrorChunk = {
	RIVER_SPECIAL_TYPE_KEY: 'stream_fatal_error';
	error: RiverError;
};

export type RiverSpecialChunk =
	| RiverSpecialStartChunk
	| RiverSpecialEndChunk
	| RiverSpecialErrorChunk
	| RiverSpecialFatalErrorChunk;

// river stream providers

type RiverStreamActiveMethods<ChunkType> = {
	appendChunk: (chunk: ChunkType) => Promise<Result<null, RiverError>>;
	sendFatalErrorAndClose: (error: RiverError) => Promise<Result<null, RiverError>>;
	appendError: (error: RiverError) => Promise<Result<null, RiverError>>;
	close: () => Promise<Result<null, RiverError>>;
};

export type RiverProvider<ChunkType, IsResumable extends boolean> = {
	providerId: string;
	isResumable: IsResumable;
	startStream: (args: {
		input: unknown;
		adapterRequest: unknown;
		routerStreamKey: string;
		abortController: AbortController;
		runnerFn: RiverStreamRunner<unknown, ChunkType, unknown>;
	}) => Promise<Result<AsyncIterableStream<CallerStreamItems<ChunkType>>, RiverError>>;
	resumeStream: (data: {
		abortController: AbortController;
		resumptionToken: RiverResumptionToken;
	}) => Promise<Result<AsyncIterableStream<CallerStreamItems<ChunkType>>, RiverError>>;
};

// river streams

export type RiverStream<InputType, ChunkType, IsResumable extends boolean, AdapterRequestType> = {
	_phantom?: {
		inputType: InputType;
		chunkType: ChunkType;
		isResumable: IsResumable;
	};
	inputSchema: z.ZodType<InputType>;
	provider: RiverProvider<ChunkType, IsResumable>;
	runner: RiverStreamRunner<InputType, ChunkType, AdapterRequestType>;
};

type RiverStreamRunner<InputType, ChunkType, AdapterRequestType = null> = (args: {
	input: InputType;
	streamRunId: string;
	streamStorageId: string;
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
		provider: RiverProvider<ChunkType, IsResumable>
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

// callers shared types

export type CallerStreamItems<ChunkType = unknown> =
	| { type: 'chunk'; chunk: ChunkType }
	| { type: 'special'; special: RiverSpecialChunk }
	| { type: 'aborted' };

export type CallerAsyncIterable<ChunkType> = AsyncIterable<CallerStreamItems<ChunkType>>;

// river server side callers

type AsyncIterableStream<T> = ReadableStream<T> & AsyncIterable<T>;

type ServerSideStartCaller<InputType, ChunkType, AdapterRequestType> = (args: {
	abortController?: AbortController;
	input: InputType;
	adapterRequest: AdapterRequestType;
}) => Promise<Result<AsyncIterableStream<CallerStreamItems<ChunkType>>, RiverError>>;

type ServerSideResumeCaller<ChunkType> = (args: {
	abortController?: AbortController;
	resumeKey: string;
}) => Promise<Result<AsyncIterableStream<CallerStreamItems<ChunkType>>, RiverError>>;

export type MakeServerSideCaller<InputType, ChunkType, AdapterRequestType> = {
	start: ServerSideStartCaller<InputType, ChunkType, AdapterRequestType>;
	resume: ServerSideResumeCaller<ChunkType>;
};

export type ServerSideCaller<T extends RiverRouter> = {
	[K in keyof T]: MakeServerSideCaller<
		InferRiverStreamInputType<T[K]>,
		InferRiverStreamChunkType<T[K]>,
		InferRiverStreamAdapterRequestType<T[K]>
	>;
};

// client side callers

export type ClientSideCaller<T extends RiverRouter> = {
	[K in keyof T]: MakeClientSideCaller<
		InferRiverStreamInputType<T[K]>,
		InferRiverStreamChunkType<T[K]>
	>;
};

export type MakeClientSideCaller<InputType, ChunkType> = {
	start: ClientSideStartCaller<InputType, ChunkType>;
	resume: ClientSideResumeCaller<ChunkType>;
};

export type ClientSideStartCaller<InputType, ChunkType> = (args: {
	input: InputType;
	abortController?: AbortController;
}) => Promise<Result<CallerAsyncIterable<ChunkType>, RiverError>>;

export type ClientSideResumeCaller<ChunkType> = (args: {
	resumeKey: string;
	abortController?: AbortController;
}) => Promise<Result<CallerAsyncIterable<ChunkType>, RiverError>>;

// river helper types

export type InferRiverStream<T extends AnyRiverStream> =
	T extends RiverStream<
		infer InputType,
		infer ChunkType,
		infer IsResumable,
		infer AdapterRequestType
	>
		? RiverStream<InputType, ChunkType, IsResumable, AdapterRequestType>
		: never;

export type InferRiverStreamInputType<T extends AnyRiverStream> =
	T extends RiverStream<infer InputType, any, any, any> ? InputType : never;

export type InferRiverStreamChunkType<T extends AnyRiverStream> =
	T extends RiverStream<any, infer ChunkType, any, any> ? ChunkType : never;

export type InferRiverStreamIsResumable<T extends AnyRiverStream> =
	T extends RiverStream<any, any, infer IsResumable, any> ? IsResumable : never;

export type InferRiverStreamAdapterRequestType<T extends AnyRiverStream> =
	T extends RiverStream<any, any, any, infer AdapterRequestType> ? AdapterRequestType : never;
