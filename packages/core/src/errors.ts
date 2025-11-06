import { Result } from 'neverthrow';
import type { RiverSpecialErrorChunk } from './types';

export type RiverErrorType = 'custom' | 'stream' | 'network' | 'storage' | 'unknown' | 'internal';

export const parseErrorChunk = (rawChunk: string): RiverSpecialErrorChunk => {
	const chunkResult = Result.fromThrowable(
		() => {
			const parsed = JSON.parse(rawChunk);
			return {
				...parsed,
				error: RiverError.fromJSON(parsed.error)
			};
		},
		(error) => {
			return {
				RIVER_SPECIAL_TYPE_KEY: 'stream_error' as const,
				streamRunId: 'unknown',
				error: new RiverError('Got unknown error chunk...', error, 'unknown', {
					rawChunk
				})
			};
		}
	)();

	if (chunkResult.isErr()) {
		return chunkResult.error;
	}

	return chunkResult.value;
};

export class RiverError {
	__name__ = 'RiverError';
	message: string;
	type: RiverErrorType;
	cause?: unknown;
	context?: Record<string, any>;

	constructor(
		message: string,
		cause?: unknown,
		type: RiverErrorType = 'unknown',
		context?: Record<string, any>
	) {
		this.message = message;
		this.type = type;
		this.cause = cause;
		this.context = context;
	}

	toJSON() {
		return {
			__name__: this.__name__,
			message: this.message,
			type: this.type,
			cause: this.cause,
			context: this.context
		};
	}

	static fromJSON(obj: any): RiverError {
		if (!obj || typeof obj !== 'object' || obj.__name__ !== 'RiverError') {
			return new RiverError('Unknown error');
		}
		return new RiverError(
			obj.message || 'Unknown error',
			obj.cause,
			obj.type || 'unknown',
			obj.context
		);
	}
}
