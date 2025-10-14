<script lang="ts">
	import { myRiverClient } from '../client.js';

	const basicS2StreamTest = myRiverClient.s2StreamFirstTest({
		onChunk: (chunk) => {
			console.log(chunk);
		},
		onStart: () => {
			console.log('Starting S2 stream test');
		},
		onError: (error) => {
			console.error(error);
		},
		onSuccess: () => {
			console.log('Finished S2 stream test');
		}
	});
</script>

<div class="flex flex-col gap-4 p-8">
	<button onclick={() => basicS2StreamTest.start({ message: 'Hello, world!' })}
		>Start S2 stream test</button
	>
</div>
