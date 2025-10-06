import type { StreamTextResult, TextStreamPart, Tool, ToolSet } from 'ai';
import z from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import type { RiverError } from './errors.js';

// AGENTS SECTION
type AiSdkRiverAgent<T extends ToolSet, I> = {
	_phantom?: {
		chunkType: TextStreamPart<T>;
		inputType: I;
	};
	agent: (input: I, abortSignal: AbortSignal) => StreamTextResult<T, never>;
	type: 'ai-sdk';
	inputSchema: z.ZodType<I>;
	// ideas for future: before run guard, resumability pipe, pipe elsewhere in background...
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
	// ideas for future: before run guard, resumability pipe, pipe elsewhere in background...
};

type AnyRiverAgent = AiSdkRiverAgent<any, any> | CustomRiverAgent<any, any>;

// INFER HELPER TYPES
type InferRiverAgentChunkType<T> = T extends { _phantom?: { chunkType: infer Chunk } }
	? Chunk
	: never;
type InferRiverAgentInputType<T> = T extends { _phantom?: { inputType: infer Input } }
	? Input
	: never;
type InferRiverAgent<T> =
	T extends AiSdkRiverAgent<infer Tools, infer Input>
		? AiSdkRiverAgent<Tools, Input>
		: T extends CustomRiverAgent<infer Chunk, infer Input>
			? CustomRiverAgent<Chunk, Input>
			: never;

// CREATE AGENT FUNCTION TYPES
type CreateAiSdkRiverAgent = <T extends ToolSet, I>(args: {
	agent: (input: I, abortSignal: AbortSignal) => StreamTextResult<T, never>;
	inputSchema: z.ZodType<I>;
}) => AiSdkRiverAgent<T, I>;

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
	}) => Promise<void>;
};

type ServerEndpointHandler = <T extends AgentRouter>(
	router: DecoratedAgentRouter<T>,
	hooks?: LifecycleHooks<T>
) => { POST: (event: RequestEvent) => Promise<Response> };

export type HookWithError<T> = {
	try: (args: T) => Promise<void> | void;
	catch: (error: unknown, args: T) => Promise<void> | void;
};

export type LifecycleHooks<T extends AgentRouter> = {
	beforeAgentRun?:
		| HookWithError<{
				event: RequestEvent;
				agentId: keyof T;
				input: InferRiverAgentInputType<T[keyof T]>;
				abortController: AbortController;
		  }>
		| (<K extends keyof T>(args: {
				event: RequestEvent;
				agentId: K;
				input: InferRiverAgentInputType<T[K]>;
				abortController: AbortController;
		  }) => Promise<void> | void);
	afterAgentRun?:
		| HookWithError<{
				event: RequestEvent;
				agentId: keyof T;
				input: InferRiverAgentInputType<T[keyof T]>;
		  }>
		| (<K extends keyof T>(ctx: {
				event: RequestEvent;
				agentId: K;
				input: InferRiverAgentInputType<T[K]>;
		  }) => void | Promise<void>);
	onAbort?:
		| HookWithError<{
				event: RequestEvent;
				agentId: keyof T;
				input: InferRiverAgentInputType<T[keyof T]>;
				reason?: unknown;
		  }>
		| (<K extends keyof T>(ctx: {
				event: RequestEvent;
				agentId: K;
				input: InferRiverAgentInputType<T[K]>;
				reason?: unknown;
		  }) => void);
	onError?: <K extends keyof T>(ctx: {
		event: RequestEvent;
		error: RiverError;
		agentId: K;
		input: InferRiverAgentInputType<T[K]>;
	}) => void | Promise<void>;
};

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
