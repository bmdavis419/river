export function createAsyncIterableStream<T>(
	stream: ReadableStream<T>
): ReadableStream<T> & AsyncIterable<T> {
	const asyncIterable = {
		async *[Symbol.asyncIterator]() {
			const reader = stream.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					yield value;
				}
			} finally {
				reader.releaseLock();
			}
		}
	};

	return Object.assign(stream, asyncIterable);
}
