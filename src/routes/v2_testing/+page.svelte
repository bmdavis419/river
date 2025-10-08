<script lang="ts">
	import { myFirstV2RiverClient } from './river/client.js';

	const { start, stop, status } = myFirstV2RiverClient.firstV2Agent({
		onStreamInfo(data) {
			console.log('stream info', data);
		},
		onStart() {
			console.log('start');
		},
		onChunk(chunk, index) {
			console.log('chunk', chunk, index);
		},
		onSuccess() {
			console.log('success');
		},
		onError(error) {
			console.log('error', error);
		},
		onCancel() {
			console.log('cancel');
		}
	});

	$inspect(status);
</script>

<div class="flex flex-col items-start gap-4 p-8">
	<button
		onclick={() => start({ prompt: 'Hello, world!' })}
		class="rounded-md bg-blue-500 p-2 text-white"
		disabled={status === 'running'}>Start</button
	>
	<button
		onclick={() => stop()}
		class="rounded-md bg-red-500 p-2 text-white"
		disabled={status !== 'running'}>Stop</button
	>
	<div>{status}</div>
</div>
