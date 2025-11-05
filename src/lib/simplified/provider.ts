import { err, ok, Result, ResultAsync } from 'neverthrow';
import { RiverError } from './errors.js';
import type {
	RiverProvider,
	RiverSpecialEndChunk,
	RiverSpecialErrorChunk,
	RiverSpecialStartChunk
} from './types.js';
import { encodeRiverResumptionToken } from './resumeTokens.js';

const DEFAULT_PROVIDER_ID = 'default';

export const defaultRiverProvider = (): RiverProvider<false> => ({
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
	initStream: async ({ abortController, adapterRequest, routerStreamKey, input, runnerFn }) => {
		let startTime = performance.now();

		const streamRunId = crypto.randomUUID();
		// in other providers, this should be passed in as a parameter at the top level of the provider creation function
		const streamStorageId = 'default_storage_id';

		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				const encoder = new TextEncoder();

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
					return err(startSendResult.error);
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
				console.log('canceling stream', reason);
				abortController.abort(reason);
			}
		});

		return ok(stream);
	}
});
