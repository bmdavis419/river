import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

const getAiStream = () => {
	const prompt = 'Is the earth flat?';

	return streamText({
		model: openrouter('x-ai/grok-4-fast:free', {
			reasoning: {
				enabled: true,
				effort: 'medium'
			}
		}),
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	});
};

// TODO:
// there is a lot to think about with this. tbh I think just getting better typesafety out of the AI sdk could do really well. The way it works right now is awesome for generic streams, which can be useful, but for the AI sdk it's probably a little weird and not needed. I think I keep the current streams pattern for custom streams, and then make a special one just for the AI sdk. It will not need zod or anything, just need to pass in the types from stream text and then make a client consumer that does not use zod, just types.
type BrothermanBill = ReturnType<typeof getAiStream>;

export const GET = async () => {
	return new Response();
};
