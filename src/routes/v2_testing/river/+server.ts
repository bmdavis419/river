import { V2_DEV } from '$lib/index.js';
import { myV2RiverRouter } from './router.js';

export const { POST } = V2_DEV.RIVER_SERVER.createServerEndpointHandler(myV2RiverRouter);
