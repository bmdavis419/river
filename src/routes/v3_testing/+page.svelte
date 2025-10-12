<script lang="ts">
	import { myV3Client } from './client.js';

	const questionAskerTest = myV3Client.questionAsker({
		onStart: () => {
			console.log('Starting');
		},
		onChunk: (chunk) => {
			console.log(chunk);
		},
		onError: (error) => {
			console.error(error);
		},
		onSuccess: () => {
			console.log('Success');
		},
		onCancel: () => {
			console.log('Canceled');
		},
		onStreamInfo: (streamInfo) => {
			console.log(streamInfo);
		}
	});

	const vowelCounterTest = myV3Client.vowelCounter({
		onStart: () => {
			console.log('Starting');
		},
		onChunk: (chunk) => {
			console.log(chunk);
		},
		onError: (error) => {
			console.error(error);
		},
		onSuccess: () => {
			console.log('Success');
		},
		onCancel: () => {
			console.log('Canceled');
		},
		onStreamInfo: (streamInfo) => {
			console.log(streamInfo);
		}
	});
</script>

<button onclick={() => vowelCounterTest.start({ yourName: 'Benjamin Davis' })}
	>Start Vowel Counter</button
>
<button onclick={() => questionAskerTest.start({ prompt: 'What is the capital of France?' })}
	>Start Question Asker</button
>
