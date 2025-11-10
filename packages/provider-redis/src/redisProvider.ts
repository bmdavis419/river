import type { CallerStreamItems, RiverSpecialFatalErrorChunk } from '@davis7dotsh/river-core';
import {
	encodeRiverResumptionToken,
	RiverError,
	type RiverProvider,
	type RiverSpecialErrorChunk,
	type RiverSpecialStartChunk,
	type RiverSpecialEndChunk,
	createAsyncIterableStream
} from '@davis7dotsh/river-core';
import type Redis from 'ioredis';
import { err, ok, Result, ResultAsync } from 'neverthrow';

// TODO: the resuming logic is pretty fucked up right now, the chunk format needs to be fixed

// how to make redis actually work:
// - chunks have to be sent in as strings (they are saved as strings in redis with the key "item")
// - need a special "end" chunk (not a river special chunk, but a redis one) that hits whenever errors or ends happen (saved as string with key "end")

const REDIS_PROVIDER_ID = 'redis';

const getRedisStreamKey = (args: { streamStorageId: string; streamRunId: string }) =>
	`stream-${args.streamStorageId}-${args.streamRunId}`;

export const redisProvider = (args: {
	redisClient: Redis;
	waitUntil: (promise: Promise<unknown>) => void | undefined;
	streamStorageId: string;
}): RiverProvider<any, true> => ({
	providerId: REDIS_PROVIDER_ID,
	isResumable: true,
	resumeStream: async ({ abortController, resumptionToken }) => {
		const { redisClient } = args;

		let wasClosed = false;

		const stream = new ReadableStream<CallerStreamItems<any>>({
			async start(controller) {
				const redisStreamKey = getRedisStreamKey({
					streamStorageId: resumptionToken.streamStorageId,
					streamRunId: resumptionToken.streamRunId
				});

				const appendItemFromRedis = async (item: string) => {
					if (abortController.signal.aborted || wasClosed) {
						return err(new RiverError('Stream was aborted', undefined, 'stream'));
					}
					return Result.fromThrowable(
						() => {
							const chunk = JSON.parse(item) as CallerStreamItems<any>;
							controller.enqueue(chunk);
							return null;
						},
						(error) => {
							return new RiverError('Failed to parse and send item', error, 'stream');
						}
					)();
				};

				const appendError = async (error: RiverError) => {
					if (abortController.signal.aborted || wasClosed) {
						return err(new RiverError('Stream was aborted', undefined, 'stream'));
					}
					return Result.fromThrowable(
						() => {
							const errorChunk: RiverSpecialErrorChunk = {
								RIVER_SPECIAL_TYPE_KEY: 'stream_error',
								error
							};
							controller.enqueue({ type: 'special', special: errorChunk });
							return null;
						},
						(error) => {
							return new RiverError('Failed to send error', error, 'stream');
						}
					)();
				};

				let totalTriesToSend = 0;
				let lastId = '0';

				while (totalTriesToSend < 1000 && !wasClosed && !abortController.signal.aborted) {
					totalTriesToSend++;

					const streamsResult = await ResultAsync.fromPromise(
						redisClient.xread('BLOCK', 10, 'STREAMS', redisStreamKey, lastId),
						(error) => {
							console.log('failed to read stream', error);
							return new RiverError('Failed to read stream', error, 'stream', {
								redisStreamKey
							});
						}
					);

					if (streamsResult.isErr()) {
						await appendError(streamsResult.error);
						break;
					}

					const streamsValue = streamsResult.value;

					if (!streamsValue || streamsValue.length === 0) {
						continue;
					}

					const [result] = streamsValue;

					if (!result) {
						continue;
					}

					const [, entries] = result;

					for (const [id, fields] of entries) {
						const [type, data] = fields;

						if (type === 'item' && data) {
							appendItemFromRedis(data);
						} else if (type === 'end') {
							wasClosed = true;
							break;
						}

						lastId = id;
					}
				}

				if (!wasClosed && !abortController.signal.aborted) {
					wasClosed = true;
					controller.close();
				}
			},
			async cancel() {
				wasClosed = true;
			}
		});

		return ok(createAsyncIterableStream(stream));
	},
	startStream: async ({ abortController, adapterRequest, routerStreamKey, input, runnerFn }) => {
		let startTime = performance.now();

		const streamRunId = crypto.randomUUID();

		const { redisClient, waitUntil, streamStorageId } = args;

		const encodeResumptionTokenResult = encodeRiverResumptionToken({
			providerId: REDIS_PROVIDER_ID,
			routerStreamKey,
			streamStorageId,
			streamRunId
		});

		if (encodeResumptionTokenResult.isErr()) {
			return err(encodeResumptionTokenResult.error);
		}

		let streamController: ReadableStreamDefaultController<CallerStreamItems<any>>;

		let wasClosed = false;

		const stream = new ReadableStream<CallerStreamItems<any>>({
			async start(controller) {
				streamController = controller;
			},
			async cancel() {
				wasClosed = true;
			}
		});

		let totalChunks = 0;

		const redisStreamKey = getRedisStreamKey({ streamStorageId, streamRunId });

		const safeSendChunk = async (chunk: CallerStreamItems<any>) => {
			// we don't care if this explodes, it will if it's aborted anyway
			if (!abortController.signal.aborted && !wasClosed) {
				try {
					streamController.enqueue(chunk);
				} catch {}
			}
			const stringifiedChunk = JSON.stringify(chunk);
			return await ResultAsync.fromPromise(
				redisClient.xadd(redisStreamKey, '*', 'item', stringifiedChunk),
				(error) => new RiverError('Failed to send chunk to Redis', error, 'stream')
			).map(() => null);
		};

		const safeSendEndChunk = async () => {
			return await ResultAsync.fromPromise(
				redisClient.xadd(redisStreamKey, '*', 'end', 'STREAM_END'),
				(error) => new RiverError('Failed to send chunk to Redis', error, 'stream')
			).map(() => null);
		};

		const startChunk: RiverSpecialStartChunk = {
			RIVER_SPECIAL_TYPE_KEY: 'stream_start',
			streamRunId,
			encodedResumptionToken: encodeResumptionTokenResult.value
		};

		const startSendResult = await safeSendChunk({ type: 'special', special: startChunk });

		if (startSendResult.isErr()) {
			return err(startSendResult.error);
		}

		const appendChunk = async (chunk: unknown) => {
			totalChunks++;
			return safeSendChunk({ type: 'chunk', chunk });
		};

		const sendFatalErrorAndClose = async (error: RiverError) => {
			const fatalErrorChunk: RiverSpecialFatalErrorChunk = {
				RIVER_SPECIAL_TYPE_KEY: 'stream_fatal_error',
				error
			};

			const fatalErrorSendResult = await safeSendChunk({
				type: 'special',
				special: fatalErrorChunk
			});

			await safeSendEndChunk();

			if (!wasClosed && !abortController.signal.aborted) {
				wasClosed = true;
				streamController.close();
			}

			return fatalErrorSendResult;
		};

		const appendError = async (error: RiverError) => {
			const errorChunk: RiverSpecialErrorChunk = {
				RIVER_SPECIAL_TYPE_KEY: 'stream_error',
				error
			};

			const errorSendResult = await safeSendChunk({
				type: 'special',
				special: errorChunk
			});

			return errorSendResult;
		};

		const close = async () => {
			const endChunk: RiverSpecialEndChunk = {
				RIVER_SPECIAL_TYPE_KEY: 'stream_end',
				totalChunks,
				totalTimeMs: performance.now() - startTime
			};

			const closeSendResult = await safeSendChunk({ type: 'special', special: endChunk });

			await safeSendEndChunk();

			if (!abortController.signal.aborted && !wasClosed) {
				wasClosed = true;
				streamController.close();
			}

			return closeSendResult;
		};

		const run = async () => {
			const runnerResult = await ResultAsync.fromPromise(
				runnerFn({
					input,
					streamRunId,
					streamStorageId,
					stream: { appendChunk, appendError, close, sendFatalErrorAndClose },
					abortSignal: abortController.signal,
					adapterRequest
				}),
				(error) => new RiverError('Failed to run runner function', error, 'stream')
			);

			if (runnerResult.isErr()) {
				await sendFatalErrorAndClose(runnerResult.error);
			} else {
				if (!abortController.signal.aborted && !wasClosed) {
					wasClosed = true;
					streamController.close();
				}
			}
		};

		waitUntil(run());

		return ok(createAsyncIterableStream(stream));
	}
});
