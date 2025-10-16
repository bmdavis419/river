import { RIVER_SERVERS } from '$lib/river/server.js';
import { RIVER_PROVIDERS } from '$lib/river/providers.js';
import { myRiverRouter } from './router.js';
import { S2_TOKEN } from '$env/static/private';

const S2_ACCESS_TOKEN = S2_TOKEN;

const { POST, GET } = RIVER_SERVERS.createSvelteKitEndpointHandler({
	streams: myRiverRouter,
	resumableProviders: {
		s2: RIVER_PROVIDERS.s2RiverStorageProvider(S2_ACCESS_TOKEN)
	}
});

export { POST, GET };
