<script lang="ts">
	import { createStreamConsumer } from '$lib/index.js';
	import { sandboxSseStream, sandboxTextStream } from './sandboxStream.js';

	const textStreamConsumer = createStreamConsumer(sandboxTextStream, {
		onChunk: (chunk) => {
			console.log(chunk);
		}
	});

	const sseStreamConsumer = createStreamConsumer(sandboxSseStream, {
		onChunk: (chunk) => {
			console.log(chunk);
		}
	});

	const handleStartStreams = () => {
		textStreamConsumer.start('/sandbox/consume/text');
		sseStreamConsumer.start('/sandbox/consume/sse');
	};
</script>

<div>
	<h1>Sandbox</h1>
	<button onclick={handleStartStreams}>Start Streams</button>
</div>
