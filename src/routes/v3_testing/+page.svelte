<script lang="ts">
	import { myV3Client } from './client.js';

	const { start } = myV3Client.vowelCounter({
		onStart: () => {
			console.log('Starting');
		},
		onChunk: (chunk) => {
			console.log(chunk);
		}
	});
</script>

<button onclick={() => start({ yourName: 'Ben' })}>Start</button>
