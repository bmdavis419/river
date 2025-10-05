import { RIVER_SERVER } from '$lib/index.js';
import z from 'zod';
import { demoAiStream } from './garbage.js';

// in the real world this should be in src/lib/river/agents.ts

export const exampleAiSdkAgent = RIVER_SERVER.createAiSdkAgent({
	inputSchema: z.object({
		prompt: z.string()
	}),
	agent: ({ prompt }) => {
		return demoAiStream(prompt);
	}
});

export const exampleCustomAgent = RIVER_SERVER.createCustomAgent({
	inputSchema: z.object({
		yourName: z.string()
	}),
	streamChunkSchema: z.object({
		character: z.string(),
		index: z.number()
	}),
	agent: async ({ yourName }, append) => {
		const characters = yourName.split('');
		let index = 0;
		for (const character of characters) {
			// yea i vibe coded this regex fight me
			if (/^[a-zA-Z]$/.test(character)) {
				append({ character, index });
				index++;
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}
	}
});
