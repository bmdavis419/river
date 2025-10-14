import { RIVER_CLIENT_SVELTEKIT } from '$lib/index.js';
import type { MyV3Router } from './router.js';

export const myV3Client =
	RIVER_CLIENT_SVELTEKIT.createSvelteKitRiverClient<MyV3Router>('/examples');
