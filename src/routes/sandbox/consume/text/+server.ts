import { createStreamSender } from '$lib/index.js';
import { sandboxTextStream, words } from '../../sandboxStream.js';

export const GET = async () => {
	const streamSender = createStreamSender(sandboxTextStream);

	const bonusStream = new ReadableStream<string>({
		async start(controller) {
			controller.enqueue('bonus');
			controller.enqueue('big');
			await new Promise((resolve) => setTimeout(resolve, 10));
			controller.enqueue('stair');
			controller.close();
		}
	});

	(async () => {
		for (let i = 0; i < 50; i++) {
			const randomWord = words[Math.floor(Math.random() * words.length)];
			streamSender.append(randomWord);
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		await streamSender.pipeIn(bonusStream);
		streamSender.close();
	})();

	return new Response(streamSender.stream);
};
