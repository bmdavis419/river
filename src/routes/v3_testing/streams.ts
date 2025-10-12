import { defaultRiverStorageProvider } from '$lib/v3_dev/providers.js';
import { createRiverStream } from '$lib/v3_dev/streams.js';
import z from 'zod';

const myFirstNewRiverStream = createRiverStream()
	.input(
		z.object({
			yourName: z.string()
		})
	)
	.runner(async (stuff) => {
		const { input, initStream } = stuff;

		const activeStream = await initStream(
			defaultRiverStorageProvider<{
				isVowel: boolean;
				letter: string;
			}>()
		);

		const { yourName } = input;

		activeStream.sendData(async ({ appendChunk }) => {
			const letters = yourName.split('');
			const onlyLetters = letters.filter((letter) => letter.match(/[a-zA-Z]/));
			for (const letter of onlyLetters) {
				appendChunk({ isVowel: !!letter.match(/[aeiou]/i), letter });
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		});

		return activeStream;
	});
