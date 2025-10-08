import { RIVER_AGENTS } from '$lib/index.js';
import { myFirstV2Agent } from './agents.js';

export const myV2RiverRouter = RIVER_AGENTS.createAgentRouter({
	firstV2Agent: myFirstV2Agent
});

export type MyV2RiverRouter = typeof myV2RiverRouter;
