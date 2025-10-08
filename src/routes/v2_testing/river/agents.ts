import { RIVER_AGENTS, RIVER_STREAMS } from '$lib/index.js';
import z from 'zod';

const myFirstV2AgentStream = RIVER_STREAMS.createRiverStream(
	'my-first-v2-agent',
	RIVER_STREAMS.riverStorageDefaultProvider<{
		letter: string;
		isVowel: boolean;
	}>()
);

export const myFirstV2Agent = RIVER_AGENTS.createRiverAgent({
	inputSchema: z.object({
		prompt: z.string()
	}),
	stream: myFirstV2AgentStream,
	runner: async (args) => {
		const { input, abortSignal, meta, stream, agentRunId } = args;

		console.log('STARTING AGENT', meta.event.route.id, agentRunId);

		const allCharacters = input.prompt.split('');
		const onlyLetters = allCharacters.filter((char) => /[a-zA-Z]/.test(char));

		let idx = 0;
		while (idx < onlyLetters.length && !abortSignal.aborted) {
			console.log('APPENDING CHUNK', onlyLetters[idx]);
			stream.appendChunk({
				letter: onlyLetters[idx],
				isVowel: ['a', 'e', 'i', 'o', 'u'].includes(onlyLetters[idx].toLowerCase())
			});
			idx++;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}
});
