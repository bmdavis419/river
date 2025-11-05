import { defaultRiverProvider } from '$lib/simplified/provider.js';
import { createRiverStream } from '$lib/simplified/stream.js';
import type { SvelteKitAdapterRequest } from '$lib/simplified/types.js';
import z from 'zod';

export const myFirstSimpleRiverStream = createRiverStream<
	{
		isDeej: boolean;
		letter: string;
	},
	SvelteKitAdapterRequest
>()
	.input(
		z.object({
			prompt: z.string()
		})
	)
	.provider(defaultRiverProvider())
	.runner(async ({ stream, input }) => {
		const { appendChunk, close } = stream;

		const { prompt } = input;

		const letters = prompt.split('');
		const onlyLetters = letters.filter((letter) => letter.match(/[a-zA-Z]/));
		let idx = 0;
		for await (const letter of onlyLetters) {
			idx++;
			if (idx % 2 === 0) {
				await appendChunk({ isDeej: true, letter: letter.toUpperCase() });
			} else {
				await appendChunk({ isDeej: false, letter: letter.toLowerCase() });
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		await close();
	});
