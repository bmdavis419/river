import { createRiverRouter } from '$lib/simplified/router.js';
import { myFirstSimpleRiverStream } from './streams.js';

export const myRiverRouter = createRiverRouter({
	firstStream: myFirstSimpleRiverStream
});

export type MyRiverRouter = typeof myRiverRouter;
