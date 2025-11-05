import { createRiverClient } from '$lib/simplified/sveltekitClientAdapter.svelte.js';
import type { MyRiverRouter } from './router.js';

export const myRiverClient = createRiverClient<MyRiverRouter>('/simplified/riverStuff');
