import { RIVER_SERVER } from '$lib/index.js';
import { exampleRouter } from './router.js';

// in the real world this should probably be in src/routes/api/river/+server.ts

export const { POST } = RIVER_SERVER.createServerEndpointHandler(exampleRouter);
