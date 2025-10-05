import { getAiStream } from '$lib/v2/garbage.js';
import {
	createAgentRouter,
	createAiSdkRiverAgent,
	createCustomRiverAgent
} from '$lib/v2/server.js';
import z from 'zod';

// first sandbox test of river v2
const myFirstAgent = createAiSdkRiverAgent({
	inputSchema: z.object({
		prompt: z.string()
	}),
	agent: ({ prompt }) => {
		const stream = getAiStream(prompt);
		console.log(stream);
		return stream;
	}
});

const myCustomAgent = createCustomRiverAgent({
	inputSchema: z.object({
		name: z.string()
	}),
	streamChunkSchema: z.object({
		index: z.number(),
		character: z.string()
	}),
	agent: async (input, appendToStream) => {
		for (let i = 0; i < input.name.length; i++) {
			const character = input.name[i];
			appendToStream({ index: i, character });
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
});

export const myRiverRouter = createAgentRouter({
	myFirstAgent,
	myCustomAgent
});

export type MyRiverRouterType = typeof myRiverRouter;
