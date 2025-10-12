import { createSvelteKitServerEndpointHandler } from '$lib/v3_dev/server.js';
import { myV3Router } from './router.js';

export const { POST } = createSvelteKitServerEndpointHandler(myV3Router);
