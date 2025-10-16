<script lang="ts">
	import { myRiverClient } from '../client.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	const basicS2StreamTest = myRiverClient.s2StreamFirstTest({
		onChunk: (chunk) => {
			console.log(chunk.letter);
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
			goto(`?resumeKey=${encodeURIComponent(data.resumeKey)}`);
		}
	});

	$inspect(basicS2StreamTest.status);

	onMount(() => {
		const urlResumeKey = page.url.searchParams.get('resumeKey');
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
	<button onclick={() => goto('')}>Clear URL</button>
</div>
