import { RIVER_CLIENT_SVELTEKIT } from '$lib/index.js';
import type { MyRiverRouter } from './router.js';

export const myRiverClient =
	RIVER_CLIENT_SVELTEKIT.createSvelteKitRiverClient<MyRiverRouter>('/examples');
