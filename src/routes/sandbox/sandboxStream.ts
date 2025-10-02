import { createSseStream, createTextStream } from '$lib/index.js';
import z from 'zod';

export const sandboxTextStream = createTextStream();

export const sandboxSseStreamSchema = z.object({
	word: z.string(),
	index: z.number()
});

export const sandboxSseStream = createSseStream({
	chunkSchema: sandboxSseStreamSchema
});

export const words = [
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
