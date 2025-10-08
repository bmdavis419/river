import { RIVER_CLIENT } from '$lib/index.js';
import type { MyV2RiverRouter } from './router.js';

export const myFirstV2RiverClient =
	RIVER_CLIENT.createSvelteKitRiverClient<MyV2RiverRouter>('/v2_testing/river');
