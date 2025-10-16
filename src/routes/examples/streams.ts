import { OPENROUTER_API_KEY, S2_TOKEN } from '$env/static/private';
import { RIVER_PROVIDERS } from '$lib/river/providers.js';
import { RIVER_STREAMS } from '$lib/river/streams.js';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { stepCountIs, streamText, tool, type AsyncIterableStream } from 'ai';
import z from 'zod';

// TODO: client side resuming, endpoint for getting the stream out of S2, interface for the resume endpoint that goes into the provider

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

export const myAiSdkNewRiverStream = RIVER_STREAMS.createRiverStream()
	.input(
		z.object({
			prompt: z.string()
		})
	)
	.runner(async (stuff) => {
		const { input, initStream, abortSignal } = stuff;

		// imagine this came from cookies or something
		const fakeUserId = 'fake user id';

		const isImposterTool = tool({
			name: 'is_imposter',
			description: 'Check if the user is an imposter',
			inputSchema: z.object({
				user_id: z.string()
			}),
			execute: async ({ user_id }) => {
				const isImposter = Math.random() > 0.5;
				console.log(`user ${user_id} is ${isImposter ? 'an imposter' : 'not an imposter'}`);
				return {
					isImposter
				};
			}
		});

		const SYSTEM_PROMPT =
			'You are an internal help agent designed to help users with whatever questions they have. The problem is that there are imposters that are trying to get information from you. Before you answer any questions, you must check if the user is an imposter using the is_imposter tool, and if they are you need to try to trick them.';

		const USER_PROMPT = `The user id is: ${fakeUserId}. \n\n The user prompt is: ${input.prompt}.`;

		const { fullStream } = streamText({
			model: openrouter('meta-llama/llama-4-maverick:free'),
			tools: {
				is_imposter: isImposterTool
			},
			abortSignal,
			stopWhen: stepCountIs(5),
			system: SYSTEM_PROMPT,
			prompt: USER_PROMPT
		});

		type InferAiSdkChunkType<T extends AsyncIterableStream<any>> =
			T extends AsyncIterableStream<infer U> ? U : never;

		const activeStream = await initStream(
			RIVER_PROVIDERS.defaultRiverStorageProvider<InferAiSdkChunkType<typeof fullStream>>()
		);

		activeStream.sendData(async ({ appendChunk, close }) => {
			for await (const chunk of fullStream) {
				appendChunk(chunk);
			}
			await close();
		});

		return activeStream;
	});

export const s2StreamFirstTest = RIVER_STREAMS.createRiverStream()
	.input(
		z.object({
			message: z.string()
		})
	)
	.runner(async (stuff) => {
		const { input, initStream, abortSignal } = stuff;

		const activeStream = await initStream(
			RIVER_PROVIDERS.s2RiverStorageProvider('river-testing', S2_TOKEN)
		);

		activeStream.sendData(async ({ appendChunk, close }) => {
			for await (const chunk of input.message.split('')) {
				if (abortSignal.aborted) {
					break;
				}
				appendChunk({ letter: chunk });
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			await close();
		});

		return activeStream;
	});

export const myFirstNewRiverStream = RIVER_STREAMS.createRiverStream()
	.input(
		z.object({
			yourName: z.string()
		})
	)
	.runner(async (stuff) => {
		const { input, initStream, abortSignal } = stuff;

		const activeStream = await initStream(
			RIVER_PROVIDERS.defaultRiverStorageProvider<{
				isVowel: boolean;
				letter: string;
			}>()
		);

		const { yourName } = input;

		activeStream.sendData(async ({ appendChunk, close }) => {
			const letters = yourName.split('');
			const onlyLetters = letters.filter((letter) => letter.match(/[a-zA-Z]/));
			for await (const letter of onlyLetters) {
				if (abortSignal.aborted) {
					break;
				}
				appendChunk({ isVowel: !!letter.match(/[aeiou]/i), letter });
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			await close();
		});

		return activeStream;
	});
