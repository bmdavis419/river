import { err, ok, Result, ResultAsync } from 'neverthrow';
import type {
	ClientSideAsyncIterable,
	ClientSideCaller,
	ClientSideStartCaller,
	InferRiverStreamChunkType,
	InferRiverStreamInputType,
	MakeClientSideCaller,
	RiverRouter,
	RiverSpecialChunk
} from './types';
import { RiverError } from './errors';

async function* internalConsumeToAsyncIterable(
	reader: ReadableStreamDefaultReader<any>,
	abortController?: AbortController
): ClientSideAsyncIterable<any> {
	const decoder = new TextDecoder();

	let buffer = '';

	let totalChunks = 0;
	let done = false;

	while (!done) {
		const readResult = await ResultAsync.fromPromise(reader.read(), (error) => {
			return new RiverError('Failed to read stream', error, 'network');
		});

		if (readResult.isErr()) {
			if (abortController?.signal.aborted) {
				yield { type: 'aborted' };
			} else {
				yield {
					type: 'special',
					special: {
						RIVER_SPECIAL_TYPE_KEY: 'stream_fatal_error',
						error: readResult.error
					}
				};
			}
			done = true;
			break;
		}

		const { value, done: streamDone } = readResult.value;
		done = streamDone;

		if (!value) continue;

		const decoded = decoder.decode(value, { stream: !done });
		buffer += decoded;

		const messages = buffer.split('\n\n');
		buffer = messages.pop() || '';

		for (const message of messages) {
			if (!message.trim().startsWith('data: ')) continue;

			const rawData = message.replace('data: ', '').trim();

			if (rawData.includes('RIVER_SPECIAL_TYPE_KEY')) {
				const parseResult = Result.fromThrowable(
					() => JSON.parse(rawData) as RiverSpecialChunk,
					(error) => new RiverError('Failed to parse special chunk', error, 'internal')
				)();

				if (parseResult.isErr()) {
					yield {
						type: 'special',
						special: {
							RIVER_SPECIAL_TYPE_KEY: 'stream_error',
							error: parseResult.error
						}
					};
					continue;
				}

				const parsed = parseResult.value;

				if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_fatal_error') {
					let riverError: RiverError;
					try {
						riverError = RiverError.fromJSON(parsed.error);
					} catch {
						riverError = new RiverError('Got a malformed error chunk', undefined, 'unknown', {
							rawChunk: rawData
						});
					}
					yield {
						type: 'special',
						special: {
							RIVER_SPECIAL_TYPE_KEY: 'stream_fatal_error',
							error: riverError
						}
					};
					done = true;
					break;
				}

				if (parsed.RIVER_SPECIAL_TYPE_KEY === 'stream_error') {
					let riverError: RiverError;
					try {
						riverError = RiverError.fromJSON(parsed.error);
					} catch {
						riverError = new RiverError('Got a malformed error chunk', undefined, 'unknown', {
							rawChunk: rawData
						});
					}
					yield {
						type: 'special',
						special: {
							RIVER_SPECIAL_TYPE_KEY: 'stream_error',
							error: riverError
						}
					};
					continue;
				}

				yield {
					type: 'special',
					special: parsed
				};

				continue;
			}

			let parsedChunk: unknown;
			try {
				parsedChunk = JSON.parse(rawData);
			} catch {
				parsedChunk = rawData;
			}

			yield {
				type: 'chunk',
				chunk: parsedChunk
			};
			totalChunks += 1;
		}
	}
}

export const createClientSideCaller = <T extends RiverRouter>(
	endpoint: string
): ClientSideCaller<T> => {
	return new Proxy({} as ClientSideCaller<T>, {
		get<K extends keyof T>(
			_target: ClientSideCaller<T>,
			routerStreamKey: K & (string | symbol)
		): MakeClientSideCaller<InferRiverStreamInputType<T[K]>, InferRiverStreamChunkType<T[K]>> {
			return {
				start: async ({ input, abortController }) => {
					const responseResult = await ResultAsync.fromPromise(
						fetch(endpoint, {
							method: 'POST',
							body: JSON.stringify({
								routerStreamKey,
								input
							}),
							signal: abortController?.signal
						}),
						(error) => {
							return new RiverError('Failed to start stream', error, 'network');
						}
					);

					if (responseResult.isErr()) {
						return err(responseResult.error);
					}

					if (!responseResult.value.ok) {
						let riverError: RiverError;
						try {
							const errorData = await responseResult.value.json();
							riverError = RiverError.fromJSON(errorData);
						} catch {
							riverError = new RiverError('Failed to call agent', responseResult.value);
						}
						return err(riverError);
					}

					const reader = responseResult.value.body?.getReader();
					if (!reader) {
						return err(new RiverError('Failed to get reader', undefined, 'network'));
					}

					return ok(
						internalConsumeToAsyncIterable(
							reader as ReadableStreamDefaultReader<any>,
							abortController
						)
					);
				},
				resume: async ({ resumeKey, abortController }) => {
					const responseResult = await ResultAsync.fromPromise(
						fetch(`${endpoint}?resumeKey=${encodeURIComponent(resumeKey)}`, {
							method: 'GET',
							signal: abortController?.signal
						}),
						(error) => {
							return new RiverError('Failed to start stream', error, 'network');
						}
					);

					if (responseResult.isErr()) {
						return err(responseResult.error);
					}

					if (!responseResult.value.ok) {
						let riverError: RiverError;
						try {
							const errorData = await responseResult.value.json();
							riverError = RiverError.fromJSON(errorData);
						} catch {
							riverError = new RiverError('Failed to call agent', responseResult.value);
						}
						return err(riverError);
					}

					const reader = responseResult.value.body?.getReader();
					if (!reader) {
						return err(new RiverError('Failed to get reader', undefined, 'network'));
					}

					return ok(
						internalConsumeToAsyncIterable(
							reader as ReadableStreamDefaultReader<any>,
							abortController
						)
					);
				}
			};
		}
	});
};
