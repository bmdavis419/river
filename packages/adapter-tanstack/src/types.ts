import type { DecoratedRiverRouter, RiverRouter } from '@davis7dotsh/river-core';
import type { RouteMethodHandlerCtx } from '@tanstack/react-start';

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
