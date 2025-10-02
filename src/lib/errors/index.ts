class StreamError extends Error {
	__name__ = 'StreamError';
	isFatal: boolean;
	constructor(message: string, isFatal: boolean) {
		super(message);
		this.isFatal = isFatal;
	}
}

export { StreamError };
