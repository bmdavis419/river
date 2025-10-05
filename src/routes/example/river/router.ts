import { RIVER_SERVER } from '$lib/index.js';
import { exampleAiSdkAgent, exampleCustomAgent } from './agents.js';

export const exampleRouter = RIVER_SERVER.createAgentRouter({
	exampleAiSdkAgent,
	exampleCustomAgent
});

export type ExampleRouter = typeof exampleRouter;
