<script lang="ts">
	import { riverClient } from '../river/client.js';

	let fullOutput = $state('');

	const { start, stop, status } = riverClient.exampleCustomAgent({
		onStart: () => {
			fullOutput = '';
			console.log('agent run started');
		},
		onChunk: (chunk) => {
			console.log('agent run chunk', chunk);
			fullOutput += chunk.character;
		},
		onSuccess: () => {
			console.log('agent run complete');
		},
		onError: (error) => {
			console.error('agent run error', error);
		},
		onCancel: () => console.warn('agent run cancelled')
	});
</script>

<div class="flex max-w-lg flex-col gap-4 py-10">
	<button
		onclick={() => start({ yourName: 'river river river river river river' })}
		disabled={status !== 'idle'}
		class="rounded-md bg-blue-500 p-2 text-white disabled:opacity-50">Start</button
	>
	<button
		onclick={stop}
		disabled={status !== 'running'}
		class="rounded-md bg-red-500 p-2 text-white disabled:opacity-50">Stop</button
	>
	<p class="text-sm text-gray-500">isRunning: {status}</p>
	<p>output: {fullOutput}</p>
</div>
