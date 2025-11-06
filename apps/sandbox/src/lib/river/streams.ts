import { redisClient } from '$lib/db';
import type { SvelteKitAdapterRequest } from '@davis7dotsh/river-adapter-sveltekit';
import { createRiverStream, defaultRiverProvider } from '@davis7dotsh/river-core';
import { redisProvider } from '@davis7dotsh/river-provider-redis';
import z from 'zod';

export const myFirstResumeStream = createRiverStream<
	{
		isVowel: boolean;
		letter: string;
	},
	SvelteKitAdapterRequest
>()
	.input(
		z.object({
			prompt: z.string()
		})
	)
	.provider(
		redisProvider({
			redisClient: redisClient,
			waitUntil: (promise) => {
				promise.catch((error) => {
					console.error('Background stream error:', error);
				});
			},
			streamStorageId: 'my-first-resume-stream'
		})
	)
	.runner(async ({ input, stream }) => {
		const { prompt } = input;
		const { appendChunk, close } = stream;

		const letters = prompt.split('');

		const onlyLetters = letters.filter((letter) => /^[a-zA-Z]$/.test(letter));

		const isVowel = (letter: string) => ['a', 'e', 'i', 'o', 'u'].includes(letter.toLowerCase());

		for (const letter of onlyLetters) {
			await appendChunk({ isVowel: isVowel(letter), letter });
			await new Promise((resolve) => setTimeout(resolve, 40));
		}

		await close();
	});

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
