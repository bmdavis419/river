import { ok, Result } from 'neverthrow';
import { RiverError } from './errors.js';
import type { RiverProvider, RiverSpecialEndChunk, RiverSpecialErrorChunk } from './types.js';

export const defaultRiverProvider = (): RiverProvider<false> => ({
	providerId: 'default',
	isResumable: false,
	resumeStream: async () => {
		throw new RiverError(
			'Default river provider does not support resumable streams',
			undefined,
			'custom'
		);
	},
	initStream: async (abortController) => {
		let streamController: ReadableStreamDefaultController<Uint8Array>;

		const streamRunId = crypto.randomUUID();

		new ReadableStream<Uint8Array>({
			start(controller) {
				streamController = controller;
			},
			cancel(reason) {
				abortController.abort(reason);
			}
		});

		const encoder = new TextEncoder();

		const safeSendChunk = (chunk: unknown) => {
			return Result.fromThrowable(
				() => {
					if (!abortController.signal.aborted) {
						const sseChunk = `data: ${JSON.stringify(chunk)}\n\n`;
						streamController.enqueue(encoder.encode(sseChunk));
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

		const appendChunk = async (chunk: unknown) => {
			return safeSendChunk(chunk);
		};

		const appendError = async (error: RiverError) => {
			const errorChunk: RiverSpecialErrorChunk = {
				RIVER_SPECIAL_TYPE_KEY: 'stream_error',
				streamRunId,
				error
			};

			return safeSendChunk(errorChunk);
		};

		const close = async () => {
			const endChunk: RiverSpecialEndChunk = {
				RIVER_SPECIAL_TYPE_KEY: 'stream_end',
				totalChunks: 0,
				totalTimeMs: 0
			};

			const closeSendResult = safeSendChunk(endChunk);

			if (closeSendResult.isErr()) {
				return closeSendResult;
			}

			if (!abortController.signal.aborted) {
				streamController.close();
			}

			return ok(null);
		};

		return { appendChunk, appendError, close };
	}
});
