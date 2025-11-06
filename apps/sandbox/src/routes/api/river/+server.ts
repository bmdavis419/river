import { myRiverRouter } from '$lib/river/router';
import { riverEndpointHandler } from '@davis7dotsh/river-adapter-sveltekit';

export const { GET, POST } = riverEndpointHandler(myRiverRouter);
