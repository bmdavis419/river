import { RIVER_SERVER } from '$lib/index.js';
import { exampleAiSdkAgent, exampleChatAgent, exampleCustomAgent } from './agents.js';

// in the real world this should be in src/lib/river/router.ts

export const exampleRouter = RIVER_SERVER.createAgentRouter({
	exampleAiSdkAgent,
	exampleCustomAgent,
	exampleChatAgent
});

export type ExampleRouter = typeof exampleRouter;
