import { RIVER_SERVERS } from '$lib/river/server.js';
import { myRiverRouter } from './router.js';

export const { POST } = RIVER_SERVERS.createSvelteKitEndpointHandler(myRiverRouter);
