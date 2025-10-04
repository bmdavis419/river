import { createServerEndpointHandler } from '$lib/v2/server.js';
import { myRiverRouter } from './river.js';

export const { POST } = createServerEndpointHandler(myRiverRouter);
