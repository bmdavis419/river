import { RIVER_SERVER } from '$lib/index.js';
import { exampleRouter } from './router.js';

export const { POST } = RIVER_SERVER.createServerEndpointHandler(exampleRouter);
