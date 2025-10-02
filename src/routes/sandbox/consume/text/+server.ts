import { createStreamSender } from '$lib/index.js';
import { sandboxTextStream, words } from '../../sandboxStream.js';

export const GET = async () => {
	const streamSender = createStreamSender(sandboxTextStream);

	(async () => {
		for (let i = 0; i < 50; i++) {
			const randomWord = words[Math.floor(Math.random() * words.length)];
			streamSender.append(randomWord);
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		streamSender.close();
	})();

	return new Response(streamSender.stream);
};
