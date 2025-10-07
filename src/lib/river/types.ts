import type { StreamTextResult, TextStreamPart, Tool, ToolSet } from 'ai';
import z from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import type { RiverError } from './errors.js';
import type { RiverErrorJSON } from './errors.js';

// AGENTS SECTION
type AiSdkRiverAgent<T extends ToolSet, Input, InternalInput = Input> = {
	_phantom?: {
		chunkType: TextStreamPart<T>;
		inputType: Input;
		internalInputType: InternalInput;
	};
	beforeAgentRun?: (
		input: Input,
		event: RequestEvent,
		abortSignal: AbortSignal
	) => Promise<InternalInput> | InternalInput;
	agent: (input: InternalInput, abortSignal: AbortSignal) => StreamTextResult<T, never>;
	afterAgentRun?: (status: 'success' | 'error' | 'canceled') => Promise<void> | void;
	type: 'ai-sdk';
	inputSchema: z.ZodType<Input>;
	// ideas for future: resumability pipe, pipe elsewhere in background...
};

type CustomRiverAgent<T, I> = {
	_phantom?: {
		chunkType: T;
		inputType: I;
	};
	type: 'custom';
	agent: (input: I, appendToStream: (chunk: T) => void) => Promise<void>;
	streamChunkSchema: z.ZodType<T>;
	inputSchema: z.ZodType<I>;
	// ideas for future: resumability pipe, pipe elsewhere in background...
};

type AnyRiverAgent = AiSdkRiverAgent<any, any, any> | CustomRiverAgent<any, any>;

// INFER HELPER TYPES
type InferRiverAgentChunkType<T> = T extends { _phantom?: { chunkType: infer Chunk } }
	? Chunk
	: never;
type InferRiverAgentInputType<T> = T extends { _phantom?: { inputType: infer Input } }
	? Input
	: never;
type InferRiverAgent<T> =
	T extends AiSdkRiverAgent<infer Tools, infer Input, infer InternalInput>
		? AiSdkRiverAgent<Tools, Input, InternalInput>
		: T extends CustomRiverAgent<infer Chunk, infer Input>
			? CustomRiverAgent<Chunk, Input>
			: never;

// CREATE AGENT FUNCTION TYPES
type CreateAiSdkRiverAgent = {
	<T extends ToolSet, Input>(args: {
		inputSchema: z.ZodType<Input>;
		agent: (input: Input, abortSignal: AbortSignal) => StreamTextResult<T, never>;
		afterAgentRun?: (status: 'success' | 'error' | 'canceled') => Promise<void> | void;
		beforeAgentRun?: undefined;
	}): AiSdkRiverAgent<T, Input>;

	<T extends ToolSet, Input, InternalInput>(args: {
		inputSchema: z.ZodType<Input>;
		beforeAgentRun: (
			input: Input,
			event: RequestEvent,
			abortSignal: AbortSignal
		) => Promise<InternalInput> | InternalInput;
		agent: (input: InternalInput, abortSignal: AbortSignal) => StreamTextResult<T, never>;
		afterAgentRun?: (status: 'success' | 'error' | 'canceled') => Promise<void> | void;
	}): AiSdkRiverAgent<T, Input, InternalInput>;
};

type CreateCustomRiverAgent = <T, I>(args: {
	agent: (input: I, appendToStream: (chunk: T) => void) => Promise<void>;
	streamChunkSchema: z.ZodType<T>;
	inputSchema: z.ZodType<I>;
}) => CustomRiverAgent<T, I>;

// AGENT ROUTER SECTION
type AgentRouter = Record<string, AnyRiverAgent>;

type DecoratedAgentRouter<T extends AgentRouter> = {
	[K in keyof T]: InferRiverAgent<T[K]>;
};

type ServerOnErrorHook = (ctx: {
	/** The normalized River error instance. */
	error: RiverError;
	/** The agent identifier (path) that failed. */
	agentId: string;
	/** The input provided to the agent call. */
	input: unknown;
	/** The request event for additional context. */
	event: RequestEvent;
}) => void | Promise<void>;

/** Optional formatter that controls the JSON shape sent to clients. */
type ServerErrorFormatter = (err: RiverError) => RiverErrorJSON;

type AgentRouterOptions = {
	onError?: ServerOnErrorHook;
	errorFormatter?: ServerErrorFormatter;
};

type CreateAgentRouter = <T extends AgentRouter>(agents: T) => DecoratedAgentRouter<T>;

// SERVER RUNNER SECTION
type ServerSideAgentRunner = <T extends AgentRouter>(
	router: DecoratedAgentRouter<T>
) => {
	runAgent: <K extends keyof T>(args: {
		agentId: K;
		input: InferRiverAgentInputType<T[K]>;
		streamController: ReadableStreamDefaultController<Uint8Array>;
		abortController: AbortController;
		event: RequestEvent;
	}) => Promise<void>;
};

type ServerEndpointHandler = <T extends AgentRouter>(
	router: DecoratedAgentRouter<T>,
	options?: AgentRouterOptions
) => { POST: (event: RequestEvent) => Promise<Response> };

// CLIENT CALLER SECTION
type OnCompleteCallback = (data: { totalChunks: number; duration: number }) => void | Promise<void>;
type OnErrorCallback = (error: RiverError) => void | Promise<void>;
type OnChunkCallback<Chunk> = (chunk: Chunk, index: number) => void | Promise<void>;
type OnStartCallback = () => void | Promise<void>;
type OnCancelCallback = () => void | Promise<void>;

type ClientSideCaller<Chunk, Input> = (args: {
	onComplete?: OnCompleteCallback;
	onError?: OnErrorCallback;
	onChunk?: OnChunkCallback<Chunk>;
	onStart?: OnStartCallback;
	onCancel?: OnCancelCallback;
}) => {
	start: (input: Input) => Promise<void>;
	stop: () => void;
};

type RiverClientCallerAiSdkToolSetType<T extends ClientSideCaller<TextStreamPart<any>, any>> =
	T extends ClientSideCaller<TextStreamPart<infer Tools>, any> ? Tools : never;

type RiverClientCallerToolCallInputType<T extends ToolSet, K extends keyof T> =
	T[K] extends Tool<infer Input> ? Input : never;

type RiverClientCallerToolCallOutputType<T extends ToolSet, K extends keyof T> =
	T[K] extends Tool<infer _, infer Output> ? Output : never;

type RiverClientCallerChunkType<T extends ClientSideCaller<any, any>> =
	T extends ClientSideCaller<infer Chunk, any> ? Chunk : never;

type RiverClientCallerInputType<T extends ClientSideCaller<any, any>> =
	T extends ClientSideCaller<any, infer Input> ? Input : never;

export type {
	InferRiverAgentChunkType,
	InferRiverAgentInputType,
	RiverClientCallerChunkType,
	RiverClientCallerInputType,
	RiverClientCallerAiSdkToolSetType,
	RiverClientCallerToolCallInputType,
	RiverClientCallerToolCallOutputType,
	CreateAiSdkRiverAgent,
	CreateCustomRiverAgent,
	CreateAgentRouter,
	ServerSideAgentRunner,
	ServerEndpointHandler,
	ClientSideCaller,
	AgentRouter
};
