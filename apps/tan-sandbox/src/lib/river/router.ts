import { createRiverRouter } from '@davis7dotsh/river-core';
import { myBasicRiverStream } from './streams';

export const myRiverRouter = createRiverRouter({
	basic: myBasicRiverStream
});

export type MyRiverRouter = typeof myRiverRouter;
