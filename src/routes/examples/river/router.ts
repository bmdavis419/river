import { RIVER_AGENTS } from '$lib/index.js';
import { chatAiSdkAgent, exampleAiSdkAgent, exampleCustomAgent } from './agents.js';

// in the real world this should be in src/lib/river/router.ts

export const exampleRouter = RIVER_AGENTS.createAgentRouter({
	exampleAiSdkAgent,
	exampleCustomAgent,
	// gives better go to definition experience
	chatAgent: chatAiSdkAgent
});

export type ExampleRouter = typeof exampleRouter;
