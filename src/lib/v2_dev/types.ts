import type z from 'zod';
import type { RequestEvent } from '../../routes/examples/river/$types.js';
import { Err, type Ok } from 'neverthrow';
import { RiverError } from '$lib/river/errors.js';

// TODO add nextjs bullshit in here
type RiverFrameworkMeta = {
	framework: 'sveltekit';
	event: RequestEvent;
};

type RiverStorageSpecialChunk = {
	RIVER_SPECIAL_TYPE_KEY: 'stream_start';
	agentRunId: string;
	streamId: string;
	isResumable: boolean;
};

// VERY MUCH TODO, will be the adapter for s2 or redis or whatever
type RiverStorageProvider<ChunkType, IsResumable> = {
	providerId: string;
	isResumable: IsResumable;
	init: (args: { streamId: string; agentRunId: string }) => Promise<RiverActiveStream<ChunkType>>;
};

type RiverActiveStream<ChunkType> = {
	appendChunk: (chunk: ChunkType) => void;
	close: () => void;
	stream: ReadableStream<unknown>;
};

type RiverStream<ChunkType, IsResumable> = {
	_phantom?: {
		chunkType: ChunkType;
	};
	streamId: string;
	storage: RiverStorageProvider<ChunkType, IsResumable>;
};

type CreateRiverStream = <ChunkType, IsResumable>(
	streamId: string,
	storage: RiverStorageProvider<ChunkType, IsResumable>
) => RiverStream<ChunkType, IsResumable>;

type RiverAgentRunner<InputType, ChunkType> = (args: {
	input: InputType;
	stream: {
		appendChunk: (chunk: ChunkType) => void;
		// TODO: add this in
		// pipeIn: (stream: ReadableStream<ChunkType>) => void;
	};
	agentRunId: string;
	meta: RiverFrameworkMeta;
	abortSignal: AbortSignal;
}) => Promise<void> | void;

type RiverAgent<InputType, ChunkType, IsResumable> = {
	_phantom?: {
		inputType: InputType;
		chunkType: ChunkType;
	};
	inputSchema: z.ZodType<InputType>;
	stream: RiverStream<ChunkType, IsResumable>;
	runner: RiverAgentRunner<InputType, ChunkType>;
};

type AnyRiverAgent = RiverAgent<any, any, any>;

type CreateRiverAgent = <InputType, ChunkType, IsResumable>(args: {
	inputSchema: z.ZodType<InputType>;
	stream: RiverStream<ChunkType, IsResumable>;
	runner: (args: {
		input: InputType;
		stream: {
			appendChunk: (chunk: ChunkType) => void;
		};
		agentRunId: string;
		meta: RiverFrameworkMeta;
		abortSignal: AbortSignal;
	}) => Promise<void> | void;
}) => RiverAgent<InputType, ChunkType, IsResumable>;

type AgentRouter = Record<string, AnyRiverAgent>;

type DecoratedAgentRouter<T extends AgentRouter> = {
	[K in keyof T]: InferRiverAgent<T[K]>;
};

type CreateAgentRouter = <T extends AgentRouter>(agents: T) => DecoratedAgentRouter<T>;

type ServerSideAgentRunner = <T extends AnyRiverAgent>(
	agent: RiverAgentRunner<InferRiverAgentInputType<T>, InferRiverAgentChunkType<T>>,
	activeStream: RiverActiveStream<InferRiverAgentChunkType<T>>,
	validatedInput: InferRiverAgentInputType<T>,
	abortSignal: AbortSignal,
	frameworkMeta: RiverFrameworkMeta
) => Promise<Ok<void, any> | Err<any, RiverError>>;

type ServerEndpointHandler = <T extends AgentRouter>(
	router: DecoratedAgentRouter<T>
) => { POST: (event: RequestEvent) => Promise<Response> };

type OnSuccessCallback = () => void | Promise<void>;
type OnErrorCallback = (error: RiverError) => void | Promise<void>;
type OnChunkCallback<Chunk> = (chunk: Chunk, index: number) => void | Promise<void>;
type OnStartCallback = () => void | Promise<void>;
type OnStreamInfoCallback = (data: {
	agentRunId: string;
	streamId: string;
	isResumable: boolean;
}) => void | Promise<void>;
type OnCancelCallback = () => void | Promise<void>;

interface ClientSideCaller<Input> {
	status: 'idle' | 'running' | 'canceled' | 'error' | 'success';
	start: (input: Input) => void;
	stop: () => void;
}

interface ClientSideCallerOptions<Chunk> {
	onSuccess?: OnSuccessCallback;
	onError?: OnErrorCallback;
	onChunk?: OnChunkCallback<Chunk>;
	onStart?: OnStartCallback;
	onCancel?: OnCancelCallback;
	onStreamInfo?: OnStreamInfoCallback;
}

// HELPERS
type InferRiverAgent<T extends AnyRiverAgent> =
	T extends RiverAgent<infer InputType, infer ChunkType, infer IsResumable>
		? RiverAgent<InputType, ChunkType, IsResumable>
		: never;

type InferRiverAgentInputType<T extends AnyRiverAgent> =
	T extends RiverAgent<infer InputType, any, any> ? InputType : never;

type InferRiverAgentChunkType<T extends AnyRiverAgent> =
	T extends RiverAgent<any, infer ChunkType, any> ? ChunkType : never;

type InferRiverAgentIsResumable<T extends AnyRiverAgent> =
	T extends RiverAgent<any, any, infer IsResumable> ? IsResumable : never;

export type {
	CreateRiverAgent,
	CreateRiverStream,
	ClientSideCaller,
	ClientSideCallerOptions,
	RiverStorageProvider,
	RiverStorageSpecialChunk,
	ServerSideAgentRunner,
	ServerEndpointHandler,
	AgentRouter,
	CreateAgentRouter,
	RiverAgentRunner,
	InferRiverAgent,
	InferRiverAgentInputType,
	InferRiverAgentChunkType,
	InferRiverAgentIsResumable
};
