import { command, getRequestEvent } from '$app/server';
import z from 'zod';
import { myServerCaller } from './river/serverCaller';
import { error } from '@sveltejs/kit';

export const remoteStartUnreliableStreamInBg = command(
	z.object({
		prompt: z.string()
	}),
	async ({ prompt }) => {
		const event = getRequestEvent();
		const bgStartResult = await myServerCaller.redisResume.start({
			input: {
				prompt
			},
			abortController: new AbortController(),
			adapterRequest: {
				event
			}
		});

		if (bgStartResult.isErr()) {
			console.error(bgStartResult.error);
			return error(500, bgStartResult.error);
		}

		let resumeKey: string | null = null;

		for await (const chunk of bgStartResult.value) {
			if (chunk.type === 'special') {
				if (chunk.special.RIVER_SPECIAL_TYPE_KEY === 'stream_start') {
					resumeKey = chunk.special.encodedResumptionToken ?? null;
					break;
				}
			}
		}

		return {
			resumeKey
		};
	}
);

export const remoteResumeUnreliableStream = command(
	z.object({
		resumeKey: z.string()
	}),
	async ({ resumeKey }) => {
		const streamResult = await myServerCaller.redisResume.resume({
			resumeKey,
			abortController: new AbortController()
		});

		if (streamResult.isErr()) {
			console.error(streamResult.error);
			return error(500, streamResult.error);
		}

		let totalLetters = 0;
		let totalVowels = 0;

		for await (const chunk of streamResult.value) {
			if (chunk.type === 'chunk') {
				if (chunk.chunk.isVowel) {
					totalVowels++;
				}
				totalLetters++;
			}
			if (chunk.type === 'special') {
				console.log('got special chunk', chunk.special);
			}
		}

		return {
			totalLetters,
			totalVowels
		};
	}
);

export const remoteRunUnreliableStream = command(
	z.object({
		prompt: z.string()
	}),
	async ({ prompt }) => {
		const event = getRequestEvent();
		const streamResult = await myServerCaller.redisResume.start({
			input: {
				prompt
			},
			abortController: new AbortController(),
			adapterRequest: {
				event
			}
		});

		if (streamResult.isErr()) {
			console.error(streamResult.error);
			return error(500, streamResult.error);
		}

		const stream = streamResult.value;
		let totalLetters = 0;
		let resumeKey: string | null = null;
		let totalVowels = 0;

		for await (const chunk of stream) {
			if (chunk.type === 'special') {
				if (chunk.special.RIVER_SPECIAL_TYPE_KEY === 'stream_start') {
					resumeKey = chunk.special.encodedResumptionToken ?? null;
				}
			}
			if (chunk.type === 'chunk') {
				if (chunk.chunk.isVowel) {
					totalVowels++;
				}
				totalLetters++;
			}
		}

		return {
			totalVowels,
			totalLetters,
			resumeKey
		};
	}
);
