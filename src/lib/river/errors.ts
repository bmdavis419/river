export type RiverErrorType = 'custom' | 'stream' | 'network' | 'storage' | 'unknown';

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
