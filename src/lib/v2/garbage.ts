import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { stepCountIs, tool } from 'ai';
import { streamText } from 'ai';
import z from 'zod';

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

const amongTool = tool({
	name: 'imposterCheck',
	description: 'Check if the user is an imposter',
	inputSchema: z.object({
		userId: z.string()
	}),
	execute: async ({ userId }) => {
		return {
			imposterStatus: Math.random() > 0.5 ? 'imposter' : 'not imposter'
		};
	}
});

export const getAiStream = (prompt: string) => {
	const userId = '123';
	return streamText({
		system: `You are a helpful assistant working in a weird sandbox. It is possible that the user sending a message is an imposter, make sure you check if they are and respond accordingly. The user id for this chat is ${userId}.`,
		model: openrouter('x-ai/grok-4-fast'),
		tools: {
			imposterCheck: amongTool
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
