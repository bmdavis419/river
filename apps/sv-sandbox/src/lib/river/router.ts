import { createRiverRouter } from '@davis7dotsh/river-core';
import { myBasicRiverStream, myFirstResumeStream } from './streams';

export const myRiverRouter = createRiverRouter({
	basic: myBasicRiverStream,
	redisResume: myFirstResumeStream
});

export type MyRiverRouter = typeof myRiverRouter;
