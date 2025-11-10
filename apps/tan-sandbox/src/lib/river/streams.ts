import { createRiverStream, defaultRiverProvider } from '@davis7dotsh/river-core';
import z from 'zod';

export const myBasicRiverStream = createRiverStream<{
	isVowel: boolean;
	letter: string;
}>()
	.input(
		z.object({
			prompt: z.string()
		})
	)
	.provider(defaultRiverProvider())
	.runner(async ({ input, stream }) => {
		const { prompt } = input;
		const { appendChunk, close } = stream;

		const letters = prompt.split('');

		const onlyLetters = letters.filter((letter) => /^[a-zA-Z]$/.test(letter));

		const isVowel = (letter: string) => ['a', 'e', 'i', 'o', 'u'].includes(letter.toLowerCase());

		for (const letter of onlyLetters) {
			await appendChunk({ isVowel: isVowel(letter), letter });
			await new Promise((resolve) => setTimeout(resolve, 30));
		}

		await close();
	});
