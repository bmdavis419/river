<script lang="ts">
	import { myRiverClient } from '../client.js';
	import { onMount } from 'svelte';

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
		},
		onStreamInfo: (data) => {
			console.log('Stream info:', data);
			const url = new URL(window.location.href);
			url.searchParams.set('resumeKey', data.resumeKey);
			window.history.replaceState({}, '', url);
		}
	});

	$inspect(basicS2StreamTest.status);

	onMount(() => {
		const url = new URL(window.location.href);
		const urlResumeKey = url.searchParams.get('resumeKey');
		if (urlResumeKey) {
			basicS2StreamTest.resume(urlResumeKey);
		}
	});
</script>

<div class="flex flex-col gap-4 p-8">
	<button onclick={() => basicS2StreamTest.start({ message: 'THIS IS A NEW TEST WOWOWOWOWO' })}
		>Start S2 stream test</button
	>
	<button onclick={() => basicS2StreamTest.stop()}>Stop</button>
</div>
