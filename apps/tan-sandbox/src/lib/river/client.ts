import { createRiverClient } from '@davis7dotsh/river-adapter-tanstack';
import type { MyRiverRouter } from './router';

export const myRiverClient = createRiverClient<MyRiverRouter>('/api/river');
