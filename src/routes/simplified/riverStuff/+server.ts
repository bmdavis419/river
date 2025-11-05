import { riverEndpointHandler } from '$lib/simplified/sveltekitServerAdapter.js';
import { myRiverRouter } from './router.js';

export const { GET, POST } = riverEndpointHandler(myRiverRouter);
