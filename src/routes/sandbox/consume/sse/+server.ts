import { createStreamSender } from '$lib/index.js';
import { sandboxSseStream, words } from '../../sandboxStream.js';

export const GET = async () => {
	const streamSender = createStreamSender(sandboxSseStream);

	(async () => {
		for (let i = 0; i < 50; i++) {
			const randomWord = words[Math.floor(Math.random() * words.length)];
			streamSender.append({ word: randomWord, index: i });
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		streamSender.close();
	})();

	return new Response(streamSender.stream);
};
