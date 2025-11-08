import { err, ok, Result, ResultAsync } from 'neverthrow';
import { RiverError } from './errors';
import type {
	CallerAsyncIterable,
	CallerStreamItems,
	RiverProvider,
	RiverSpecialChunk,
	RiverSpecialEndChunk,
	RiverSpecialErrorChunk,
	RiverSpecialFatalErrorChunk,
	RiverSpecialStartChunk
} from './types';
import { encodeRiverResumptionToken } from './resumeToken';
import { createAsyncIterableStream } from './helpers';

const DEFAULT_PROVIDER_ID = 'default';

// TODO: really figure out the request lifecycle of the stream here
// make sure that the abort controller aborting stops the stream
// make sure that the stream is closed when it errors, get's aborted, or completes
// make sure that chunks are not sent after the stream is aborted or closed

export const defaultRiverProvider = (): RiverProvider<any, false> => ({
	providerId: DEFAULT_PROVIDER_ID,
	isResumable: false,
	resumeStream: async () => {
		return err(
			new RiverError(
				'Default river provider does not support resumable streams',
				undefined,
				'custom'
			)
		);
	},
	startStream: async ({ input, adapterRequest, routerStreamKey, abortController, runnerFn }) => {
		let startTime = performance.now();

		const streamRunId = crypto.randomUUID();
		// in other providers, this should be passed in as a parameter at the top level of the provider creation function
		const streamStorageId = 'default_storage_id';

		const stream = new ReadableStream<CallerStreamItems<any>>({
			async start(controller) {
				let totalChunks = 0;

				const safeSendChunk = async (data: CallerStreamItems<any>) => {
					if (abortController.signal.aborted) {
						return err(new RiverError('Stream was aborted', undefined, 'stream'));
					}
					return Result.fromThrowable(
						() => {
							controller.enqueue(data);
							return null;
						},
						(error) => {
							return new RiverError('Failed to send chunk', error, 'stream');
						}
					)();
				};

				const startChunk: RiverSpecialStartChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					streamRunId
				};

				const startSendResult = await safeSendChunk({ type: 'special', special: startChunk });

				if (startSendResult.isErr()) {
					console.error('start chunk failed to send', startSendResult.error);
					controller.error(startSendResult.error);
					return;
				}

				const appendChunk = async (chunk: unknown) => {
					return await safeSendChunk({ type: 'chunk', chunk });
				};

				const appendError = async (error: RiverError) => {
					const errorChunk: RiverSpecialErrorChunk = {
						RIVER_SPECIAL_TYPE_KEY: 'stream_error',
						error
					};

					const errorSendResult = await safeSendChunk({ type: 'special', special: errorChunk });

					if (errorSendResult.isErr()) {
						return errorSendResult;
					}

					return ok(null);
				};

				const appendFatalError = async (error: RiverError) => {
					const fatalErrorChunk: RiverSpecialFatalErrorChunk = {
						RIVER_SPECIAL_TYPE_KEY: 'stream_fatal_error',
						error
					};

					const fatalErrorSendResult = await safeSendChunk({
						type: 'special',
						special: fatalErrorChunk
					});

					if (fatalErrorSendResult.isErr()) {
						return fatalErrorSendResult;
					}

					return ok(null);
				};

				const close = async () => {
					const endChunk: RiverSpecialEndChunk = {
						RIVER_SPECIAL_TYPE_KEY: 'stream_end',
						totalChunks,
						totalTimeMs: performance.now() - startTime
					};

					const closeSendResult = await safeSendChunk({ type: 'special', special: endChunk });

					if (closeSendResult.isErr()) {
						return closeSendResult;
					}

					if (!abortController.signal.aborted) {
						controller.close();
					}

					return ok(null);
				};

				const runnerResult = await ResultAsync.fromPromise(
					runnerFn({
						input,
						streamRunId,
						streamStorageId,
						stream: { appendChunk, appendError, appendFatalError, close },
						abortSignal: new AbortController().signal,
						adapterRequest
					}),
					(error) => new RiverError('Failed to run runner function', error, 'stream')
				);

				if (runnerResult.isErr()) {
					await appendFatalError(runnerResult.error);
					if (!abortController.signal.aborted) {
						controller.error(runnerResult.error);
					}

					return runnerResult.error;
				}
			},
			async cancel(reason) {}
		});

		return ok(createAsyncIterableStream(stream));
	}
});
