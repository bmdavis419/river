import { err, ok, Result, ResultAsync } from 'neverthrow';
import { RiverError } from './errors';
import type {
	RiverProvider,
	RiverSpecialChunk,
	RiverSpecialEndChunk,
	RiverSpecialErrorChunk,
	RiverSpecialStartChunk
} from './types';
import { encodeRiverResumptionToken } from './resumeToken';
import { createAsyncIterableStream } from './helpers';

const DEFAULT_PROVIDER_ID = 'default';

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
	serverSideResumeStream: async () => {
		return err(
			new RiverError(
				'Default river provider does not support resuming streams',
				undefined,
				'custom'
			)
		);
	},
	serverSideRunAndConsume: async ({ input, adapterRequest, routerStreamKey, runnerFn }) => {
		let startTime = performance.now();

		const streamRunId = crypto.randomUUID();
		// in other providers, this should be passed in as a parameter at the top level of the provider creation function
		const streamStorageId = 'default_storage_id';

		const stream = new ReadableStream<
			| {
					type: 'chunk';
					chunk: unknown;
			  }
			| {
					type: 'special';
					special: RiverSpecialChunk;
			  }
		>({
			async start(controller) {
				let totalChunks = 0;

				let wasClosed = false;

				const safeSendChunk = (
					data: { type: 'chunk'; chunk: unknown } | { type: 'special'; special: RiverSpecialChunk }
				) => {
					return Result.fromThrowable(
						() => {
							if (data.type === 'special') {
								controller.enqueue({ type: 'special', special: data.special });
							} else {
								totalChunks++;
								controller.enqueue({ type: 'chunk', chunk: data.chunk });
							}
							return null;
						},
						(error) => {
							return new RiverError('Failed to send chunk', error, 'stream');
						}
					)();
				};

				const encodeResumptionTokenResult = encodeRiverResumptionToken({
					providerId: DEFAULT_PROVIDER_ID,
					routerStreamKey,
					streamStorageId,
					streamRunId
				});

				if (encodeResumptionTokenResult.isErr()) {
					return err(encodeResumptionTokenResult.error);
				}

				const startChunk: RiverSpecialStartChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					streamRunId,
					encodedResumptionToken: encodeResumptionTokenResult.value
				};

				const startSendResult = safeSendChunk({ type: 'special', special: startChunk });

				if (startSendResult.isErr()) {
					console.error('start chunk failed to send', startSendResult.error);
					return;
				}

				const appendChunk = async (chunk: unknown) => {
					return safeSendChunk({ type: 'chunk', chunk });
				};

				const appendError = async (error: RiverError) => {
					const errorChunk: RiverSpecialErrorChunk = {
						RIVER_SPECIAL_TYPE_KEY: 'stream_error',
						streamRunId,
						error
					};

					const errorSendResult = safeSendChunk({ type: 'special', special: errorChunk });

					if (errorSendResult.isErr()) {
						return errorSendResult;
					}

					return ok(null);
				};

				const close = async () => {
					const endChunk: RiverSpecialEndChunk = {
						RIVER_SPECIAL_TYPE_KEY: 'stream_end',
						totalChunks,
						totalTimeMs: performance.now() - startTime
					};

					const closeSendResult = safeSendChunk({ type: 'special', special: endChunk });

					if (closeSendResult.isErr()) {
						return closeSendResult;
					}

					if (!wasClosed) {
						wasClosed = true;
						controller.close();
					}

					return ok(null);
				};

				const runnerResult = await ResultAsync.fromPromise(
					runnerFn({
						input,
						streamRunId,
						streamStorageId,
						stream: { appendChunk, appendError, close },
						abortSignal: new AbortController().signal,
						adapterRequest
					}),
					(error) => new RiverError('Failed to run runner function', error, 'stream')
				);

				if (runnerResult.isErr()) {
					console.error(runnerResult.error);
					if (!wasClosed) {
						wasClosed = true;
						controller.close();
					}
					return appendError(runnerResult.error);
				}
			},
			async cancel(reason) {}
		});

		return ok(createAsyncIterableStream(stream));
	},
	serverSideRunInBackground: async () => {
		return err(
			new RiverError(
				'Default river provider does not support running in the background. You need to use the redis provider instead.',
				undefined,
				'custom'
			)
		);
	},
	initStream: async ({ abortController, adapterRequest, routerStreamKey, input, runnerFn }) => {
		let startTime = performance.now();

		const streamRunId = crypto.randomUUID();
		// in other providers, this should be passed in as a parameter at the top level of the provider creation function
		const streamStorageId = 'default_storage_id';

		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const encoder = new TextEncoder();

				abortController.signal.addEventListener('abort', () => {
					controller.close();
				});

				let totalChunks = 0;

				const safeSendChunk = (chunk: unknown) => {
					return Result.fromThrowable(
						() => {
							if (!abortController.signal.aborted) {
								const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
								controller.enqueue(encoder.encode(sseChunk));
								totalChunks++;
								return null;
							} else {
								throw new Error('tried to send chunk after stream was canceled');
							}
						},
						(error) => {
							return new RiverError('Failed to send chunk', error, 'stream');
						}
					)();
				};

				const encodeResumptionTokenResult = encodeRiverResumptionToken({
					providerId: DEFAULT_PROVIDER_ID,
					routerStreamKey,
					streamStorageId,
					streamRunId
				});

				if (encodeResumptionTokenResult.isErr()) {
					return err(encodeResumptionTokenResult.error);
				}

				const startChunk: RiverSpecialStartChunk = {
					RIVER_SPECIAL_TYPE_KEY: 'stream_start',
					streamRunId,
					encodedResumptionToken: encodeResumptionTokenResult.value
				};

				const startSendResult = safeSendChunk(startChunk);

				if (startSendResult.isErr()) {
					console.error('start chunk failed to send', startSendResult.error);
					return;
				}

				const appendChunk = async (chunk: unknown) => {
					return safeSendChunk(chunk);
				};

				const appendError = async (error: RiverError) => {
					const errorChunk: RiverSpecialErrorChunk = {
						RIVER_SPECIAL_TYPE_KEY: 'stream_error',
						streamRunId,
						error
					};

					const errorSendResult = safeSendChunk(errorChunk);

					if (errorSendResult.isErr()) {
						return errorSendResult;
					}

					abortController.abort();

					return ok(null);
				};

				const close = async () => {
					const endChunk: RiverSpecialEndChunk = {
						RIVER_SPECIAL_TYPE_KEY: 'stream_end',
						totalChunks,
						totalTimeMs: performance.now() - startTime
					};

					const closeSendResult = safeSendChunk(endChunk);

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
						stream: { appendChunk, appendError, close },
						abortSignal: abortController.signal,
						adapterRequest
					}),
					(error) => new RiverError('Failed to run runner function', error, 'stream')
				);

				if (runnerResult.isErr()) {
					console.error(runnerResult.error);
					return appendError(runnerResult.error);
				}
			},
			async cancel(reason) {
				abortController.abort(reason);
			}
		});

		return ok(stream);
	}
});
