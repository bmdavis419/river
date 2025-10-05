import { RIVER_SERVER } from '$lib/index.js';
import z from 'zod';
import { demoAiStream } from './garbage.js';

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
		for (const character of characters) {
			// yea i vibe coded this regex fight me
			if (/^[a-zA-Z]$/.test(character)) {
				append({ character, index: characters.indexOf(character) });
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}
	}
});
