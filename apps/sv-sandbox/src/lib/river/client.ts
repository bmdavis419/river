import { createRiverClient } from '@davis7dotsh/river-adapter-sveltekit';
import type { MyRiverRouter } from './router';

export const myRiverClient = createRiverClient<MyRiverRouter>('/api/river');
