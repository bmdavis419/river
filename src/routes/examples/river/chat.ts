import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, type ModelMessage } from 'ai';

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

export const chatDemoAiStream = (messages: ModelMessage[], abortSignal: AbortSignal) => {
	return streamText({
		abortSignal,
		system:
			"You are an assistant designed to help answer the user's questions. Always respond in normal text format.",
		model: openrouter('meta-llama/llama-4-maverick:free'),
		messages
	});
};
