import { RIVER_SERVERS } from '$lib/river/server.js';
import { myV3Router } from './router.js';

export const { POST } = RIVER_SERVERS.createSvelteKitEndpointHandler(myV3Router);
