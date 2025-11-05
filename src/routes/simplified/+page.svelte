<script lang="ts">
	import { myRiverClient } from './riverStuff/client.js';

	let fullResponse = $state('');

	let message = $state(
		'What is the difference between typescript and javascript? Give a brief answer'
	);

	const trimmedMessage = $derived(message.trim());

	const firstStreamCaller = myRiverClient.firstStream({
		onChunk: (chunk) => {
			fullResponse += chunk.isDeej + ' ' + chunk.letter + ' ';
		},
		onStart: () => {
			console.log('Starting first stream');
		},
		onEnd: (data) => {
			console.log('Finished first stream', data);
		},
		onError: (error) => {
			console.error(error);
		}
	});

	const handleAbort = () => {
		firstStreamCaller.abort();
	};

	const handleSendMessage = () => {
		if (trimmedMessage) {
			firstStreamCaller.start({
				prompt: trimmedMessage
			});
		}
	};
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-8">
	<textarea
		bind:value={message}
		placeholder="Type your message..."
		class="min-h-32 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:border-transparent focus:ring-2 focus:ring-primary focus:outline-none"
	></textarea>
	<button
		onclick={handleSendMessage}
		disabled={!trimmedMessage}
		class="self-end rounded-lg bg-primary px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
	>
		Send
	</button>
	<button
		onclick={handleAbort}
		class="self-end rounded-lg bg-red-500 px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
	>
		Abort
	</button>
	<p>{fullResponse}</p>
</div>
