import { RIVER_SERVER } from '$lib/index.js';
import { myV2RiverRouter } from './router.js';

export const { POST } = RIVER_SERVER.createServerEndpointHandler(myV2RiverRouter);
