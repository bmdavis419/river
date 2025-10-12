export class RiverError {
	__name__ = 'RiverError';
	message: string;
	cause: unknown;

	constructor(message: string, cause?: unknown) {
		this.message = message;
		this.cause = cause;
	}
}
