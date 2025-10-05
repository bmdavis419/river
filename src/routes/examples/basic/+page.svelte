<script lang="ts">
	import { riverClient } from '../river/client.js';

	let isRunning = $state(false);
	let fullOutput = $state('');

	const { start, stop } = riverClient.agent('exampleCustomAgent').makeCaller({
		onStart: () => {
			isRunning = true;
			fullOutput = '';
			console.log('agent run started');
		},
		onChunk: (chunk) => {
			console.log('agent run chunk', chunk);
			fullOutput += chunk.character;
		},
		onComplete: (data) => {
			isRunning = false;
			console.log(
				'agent run complete took:',
				data.duration,
				'ms and produced',
				data.totalChunks,
				'chunks'
			);
		},
		onError: (error) => {
			isRunning = false;
			console.error('agent run error', error);
		},
		onCancel: () => {
			isRunning = false;
			console.warn('agent run cancelled');
		}
	});
</script>

<div class="flex max-w-lg flex-col gap-4 py-10">
	<button
		onclick={() => start({ yourName: 'river river river river river river' })}
		disabled={isRunning}
		class="rounded-md bg-blue-500 p-2 text-white disabled:opacity-50">Start</button
	>
	<button
		onclick={stop}
		disabled={!isRunning}
		class="rounded-md bg-red-500 p-2 text-white disabled:opacity-50">Stop</button
	>
	<p class="text-sm text-gray-500">isRunning: {isRunning}</p>
	<p>output: {fullOutput}</p>
</div>
