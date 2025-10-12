import { createRiverRouter } from '$lib/v3_dev/streams.js';
import { myFirstNewRiverStream } from './streams.js';

export const myV3Router = createRiverRouter({
	vowelCounter: myFirstNewRiverStream
});

export type MyV3Router = typeof myV3Router;
