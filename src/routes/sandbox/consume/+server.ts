import { createStreamSender } from '$lib/index.js';
import { sandboxStream } from '../sandboxStream.js';

const words = [
	'apple',
	'banana',
	'cherry',
	'date',
	'elderberry',
	'fig',
	'grape',
	'honeydew',
	'kiwi',
	'lemon',
	'mango',
	'nectarine',
	'orange',
	'peach',
	'quince',
	'raspberry',
	'strawberry',
	'tangerine',
	'ugli',
	'vanilla',
	'watermelon',
	'xigua',
	'yam',
	'zucchini',
	'avocado',
	'blueberry',
	'cantaloupe',
	'dragonfruit',
	'eggplant',
	'feijoa',
	'guava',
	'huckleberry',
	'jackfruit',
	'kumquat',
	'lime',
	'mulberry',
	'papaya',
	'plum',
	'rambutan',
	'soursop',
	'tomato',
	'ugni',
	'voavanga',
	'wolfberry',
	'ximenia',
	'yuzu',
	'ziziphus',
	'apricot',
	'blackberry',
	'coconut',
	'durian'
];

export const GET = async () => {
	const streamSender = createStreamSender(sandboxStream);

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
