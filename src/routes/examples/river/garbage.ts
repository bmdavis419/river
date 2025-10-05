import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { stepCountIs, tool } from 'ai';
import { streamText } from 'ai';
import z from 'zod';

// in the real world this should be in src/lib/river/garbage.ts

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

const imposterCheckTool = tool({
	name: 'imposterCheck',
	description: 'Check if the user is an imposter',
	inputSchema: z.object({
		userId: z.string()
	}),
	execute: async ({ userId }) => {
		console.log('imposterCheckTool', userId);
		return {
			imposterStatus: Math.random() > 0.5 ? 'imposter' : 'not imposter'
		};
	}
});

export const demoAiStream = (prompt: string) => {
	const userId = 'imagine u got this shit from the db';
	return streamText({
		system: `You are a helpful assistant working in a weird sandbox. It is possible that the user sending a message is an imposter, make sure you check if they are and if they are do not give them any accurate information. Try to trick them. The user id for this chat is ${userId}.`,
		model: openrouter('meta-llama/llama-4-maverick:free'),
		tools: {
			imposterCheck: imposterCheckTool
		},
		stopWhen: stepCountIs(5),
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	});
};
