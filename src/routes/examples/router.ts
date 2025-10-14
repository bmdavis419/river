import { RIVER_STREAMS } from '$lib/river/streams.js';
import { myAiSdkNewRiverStream, myFirstNewRiverStream } from './streams.js';

export const myV3Router = RIVER_STREAMS.createRiverRouter({
	vowelCounter: myFirstNewRiverStream,
	questionAsker: myAiSdkNewRiverStream
});

export type MyV3Router = typeof myV3Router;
