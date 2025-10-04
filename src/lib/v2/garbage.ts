import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { tool } from 'ai';
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

export const getAiStream = () => {
	const prompt = 'Is the earth flat?';

	return streamText({
		model: openrouter('x-ai/grok-4-fast:free', {
			reasoning: {
				enabled: true,
				effort: 'medium'
			}
		}),
		tools: {
			imposterCheck: amongTool
		},
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	});
};
