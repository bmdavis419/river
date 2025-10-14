import { RIVER_STREAMS } from '$lib/river/streams.js';
import { myAiSdkNewRiverStream, myFirstNewRiverStream, s2StreamFirstTest } from './streams.js';

export const myRiverRouter = RIVER_STREAMS.createRiverRouter({
	vowelCounter: myFirstNewRiverStream,
	questionAsker: myAiSdkNewRiverStream,
	s2StreamFirstTest: s2StreamFirstTest
});

export type MyRiverRouter = typeof myRiverRouter;
