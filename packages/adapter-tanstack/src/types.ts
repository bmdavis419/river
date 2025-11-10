import type {
	DecoratedRiverRouter,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	RiverError,
	RiverRouter
} from '@davis7dotsh/river-core';
import type { RouteMethodHandlerCtx } from '@tanstack/react-start';

// river tanstack start client types

type OnSuccessCallback = (data: {
	totalChunks: number;
	totalTimeMs: number;
}) => void | Promise<void>;
type OnErrorCallback = (error: RiverError) => void | Promise<void>;
type OnFatalErrorCallback = (error: RiverError) => void | Promise<void>;
type OnChunkCallback<Chunk> = (chunk: Chunk, index: number) => void | Promise<void>;
type OnStartCallback = () => void | Promise<void>;
type OnInfoCallback = (data: {
	streamRunId: string;
	encodedResumptionToken?: string;
}) => void | Promise<void>;
type OnAbortCallback = () => void | Promise<void>;

export type TanStackStartClientSideCaller<Input, ChunkType> = {
	_phantom?: {
		ChunkType: ChunkType;
		InputType: Input;
	};
	start: (input: Input) => void;
	resume: (resumeKey: string) => void;
	abort: () => void;
};

export type TanStackStartClientSideCallerOptions<ChunkType> = {
	onSuccess?: OnSuccessCallback;
	onError?: OnErrorCallback;
	onFatalError?: OnFatalErrorCallback;
	onChunk?: OnChunkCallback<ChunkType>;
	onStart?: OnStartCallback;
	onAbort?: OnAbortCallback;
	onInfo?: OnInfoCallback;
};

export type TanStackStartMakeClientSideCaller<InputType, ChunkType> = {
	useStream: (
		options: TanStackStartClientSideCallerOptions<ChunkType>
	) => TanStackStartClientSideCaller<InputType, ChunkType>;
};

export type TanStackStartRiverClient<T extends RiverRouter> = {
	[K in keyof T]: TanStackStartMakeClientSideCaller<
		InferRiverStreamInputType<T[K]>,
		InferRiverStreamChunkType<T[K]>
	>;
};

// river tanstack start server types

type AnyRouteMethodHandlerCtx = RouteMethodHandlerCtx<any, any, any, any, any, any>;

export type TanStackStartAdapterRequest = {
	event: AnyRouteMethodHandlerCtx;
};

export type TanStackStartRiverEndpointHandler = <T extends RiverRouter>(
	router: DecoratedRiverRouter<T>
) => {
	POST: (event: AnyRouteMethodHandlerCtx) => Promise<Response>;
	GET: (event: AnyRouteMethodHandlerCtx) => Promise<Response>;
};

// river tanstack start helper types

export type RiverInputType<T extends TanStackStartMakeClientSideCaller<any, any>> =
	T extends TanStackStartMakeClientSideCaller<infer InputType, any> ? InputType : never;

export type RiverChunkType<T extends TanStackStartMakeClientSideCaller<any, any>> =
	T extends TanStackStartMakeClientSideCaller<any, infer ChunkType> ? ChunkType : never;
