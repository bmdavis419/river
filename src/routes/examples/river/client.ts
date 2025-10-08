import { RIVER_CLIENT } from '$lib/index.js';
import type { ExampleRouter } from './router.js';

export const riverClient =
	RIVER_CLIENT.createSvelteKitRiverClient<ExampleRouter>('/examples/river');
