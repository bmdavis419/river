import { V2_DEV } from '$lib/index.js';
import type { MyV2RiverRouter } from './router.js';

export const myFirstV2RiverClient =
	V2_DEV.RIVER_CLIENT.createSvelteKitRiverClient<MyV2RiverRouter>('/v2_testing/river');
