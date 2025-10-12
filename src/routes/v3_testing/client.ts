import { createSvelteKitRiverClient } from '$lib/v3_dev/client.svelte.js';
import type { MyV3Router } from './router.js';

export const myV3Client = createSvelteKitRiverClient<MyV3Router>('/v3_testing');
