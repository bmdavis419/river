import type {
	DecoratedRiverRouter,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	RiverRouter,
	RiverError
} from '@davis7dotsh/river-core';
import type { RequestEvent } from '@sveltejs/kit';

// river sveltekit client types

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

export type SvelteKitClientSideCaller<Input, ChunkType> = {
	_phantom?: {
		ChunkType: ChunkType;
		InputType: Input;
	};
	start: (input: Input) => void;
	resume: (resumeKey: string) => void;
	abort: () => void;
};

export type SvelteKitClientSideCallerOptions<ChunkType> = {
	onSuccess?: OnSuccessCallback;
	onError?: OnErrorCallback;
	onFatalError?: OnFatalErrorCallback;
	onChunk?: OnChunkCallback<ChunkType>;
	onStart?: OnStartCallback;
	onAbort?: OnAbortCallback;
	onInfo?: OnInfoCallback;
};

export type SvelteKitMakeClientSideCaller<InputType, ChunkType> = (
	options: SvelteKitClientSideCallerOptions<ChunkType>
) => SvelteKitClientSideCaller<InputType, ChunkType>;

export type SvelteKitRiverClient<T extends RiverRouter> = {
	[K in keyof T]: SvelteKitMakeClientSideCaller<
		InferRiverStreamInputType<T[K]>,
		InferRiverStreamChunkType<T[K]>
	>;
};

// river sveltekit server types

export type SvelteKitAdapterRequest = {
	event: RequestEvent;
};

export type SvelteKitRiverEndpointHandler = <T extends RiverRouter>(
	router: DecoratedRiverRouter<T>
) => {
	POST: (event: RequestEvent) => Promise<Response>;
	GET: (event: RequestEvent) => Promise<Response>;
};

// river sveltekit helper types

export type RiverInputType<T extends SvelteKitMakeClientSideCaller<any, any>> =
	T extends SvelteKitMakeClientSideCaller<infer InputType, any> ? InputType : never;

export type RiverChunkType<T extends SvelteKitMakeClientSideCaller<any, any>> =
	T extends SvelteKitMakeClientSideCaller<any, infer ChunkType> ? ChunkType : never;
