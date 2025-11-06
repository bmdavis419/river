import type {
	ClientSideCaller,
	ClientSideCallerOptions,
	DecoratedRiverRouter,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	RiverRouter
} from '@davis7dotsh/river-core';
import type { RequestEvent } from '@sveltejs/kit';

// river sveltekit client types

export type SvelteKitMakeClientSideCaller<InputType, ChunkType> = (
	options: ClientSideCallerOptions<ChunkType>
) => ClientSideCaller<InputType, ChunkType>;

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
