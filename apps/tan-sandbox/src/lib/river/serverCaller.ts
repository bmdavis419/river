import { createServerSideCaller } from '@davis7dotsh/river-core';
import { myRiverRouter } from './router';

export const myServerCaller = createServerSideCaller(myRiverRouter);
