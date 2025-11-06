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

export type RiverProvider<ChunkType, IsResumable extends boolean> = {
	providerId: string;
	isResumable: IsResumable;
	serverSideRunInBackground: (data: {
		adapterRequest: unknown;
		routerStreamKey: string;
		input: unknown;
		runnerFn: RiverStreamRunner<unknown, ChunkType, unknown>;
	}) => Promise<Result<RiverSpecialStartChunk, RiverError>>;
	serverSideResumeStream: (data: {
		resumptionToken: RiverResumptionToken;
	}) => Promise<
		Result<
			AsyncIterableStream<
				{ type: 'chunk'; chunk: ChunkType } | { type: 'special'; special: RiverSpecialChunk }
			>,
			RiverError
		>
	>;
	serverSideRunAndConsume: (data: {
		adapterRequest: unknown;
		routerStreamKey: string;
		input: unknown;
		runnerFn: RiverStreamRunner<unknown, ChunkType, unknown>;
	}) => Promise<
		Result<
			AsyncIterableStream<
				| {
						type: 'chunk';
						chunk: ChunkType;
				  }
				| {
						type: 'special';
						special: RiverSpecialChunk;
				  }
			>,
			RiverError
		>
	>;
	resumeStream: (data: {
		abortController: AbortController;
		resumptionToken: RiverResumptionToken;
	}) => Promise<Result<ReadableStream<Uint8Array>, RiverError>>;
	initStream: (data: {
		abortController: AbortController;
		adapterRequest: unknown;
		routerStreamKey: string;
		input: unknown;
		runnerFn: RiverStreamRunner<unknown, ChunkType, unknown>;
	}) => Promise<Result<ReadableStream<Uint8Array>, RiverError>>;
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

// river server side callers

type AsyncIterableStream<T> = ReadableStream<T> & AsyncIterable<T>;

export type MakeServerSideCaller<InputType, ChunkType, AdapterRequestType> = {
	startStreamInBackground: (args: {
		input: InputType;
		adapterRequest: AdapterRequestType;
	}) => Promise<Result<RiverSpecialStartChunk, RiverError>>;
	resumeStream: (args: {
		resumeKey: string;
	}) => Promise<
		Result<
			AsyncIterableStream<
				{ type: 'chunk'; chunk: ChunkType } | { type: 'special'; special: RiverSpecialChunk }
			>,
			RiverError
		>
	>;
	startStreamAndConsume: (args: {
		input: InputType;
		adapterRequest: AdapterRequestType;
	}) => Promise<
		Result<
			AsyncIterableStream<
				| {
						type: 'chunk';
						chunk: ChunkType;
				  }
				| {
						type: 'special';
						special: RiverSpecialChunk;
				  }
			>,
			RiverError
		>
	>;
};

export type ServerSideCaller<T extends RiverRouter> = {
	[K in keyof T]: MakeServerSideCaller<
		InferRiverStreamInputType<T[K]>,
		InferRiverStreamChunkType<T[K]>,
		InferRiverStreamAdapterRequestType<T[K]>
	>;
};

// river client

type OnEndCallback = (data: { totalChunks: number; totalTimeMs: number }) => void | Promise<void>;
type OnErrorCallback = (error: RiverError) => void | Promise<void>;
type OnChunkCallback<Chunk> = (chunk: Chunk, index: number) => void | Promise<void>;
type OnStartCallback = () => void | Promise<void>;
type OnStreamInfoCallback = (data: {
	streamRunId: string;
	encodedResumptionToken?: string;
}) => void | Promise<void>;
type OnAbortCallback = () => void | Promise<void>;

export type ClientSideCaller<Input, ChunkType> = {
	_phantom?: {
		ChunkType: ChunkType;
		InputType: Input;
	};
	status: 'not_started' | 'running' | 'aborted' | 'error' | 'finished';
	start: (input: Input) => void;
	resume: (resumeKey: string) => void;
	abort: () => void;
};

export type ClientSideCallerOptions<ChunkType> = {
	onEnd?: OnEndCallback;
	onError?: OnErrorCallback;
	onChunk?: OnChunkCallback<ChunkType>;
	onStart?: OnStartCallback;
	onAbort?: OnAbortCallback;
	onStreamInfo?: OnStreamInfoCallback;
};

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
