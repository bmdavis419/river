<script lang="ts">
	import { createRiverClientCaller } from '$lib/v2/client.js';
	import type { MyRiverRouterType } from './river.js';

	const myRiverClientCaller = createRiverClientCaller<MyRiverRouterType>();

	const customAgentCaller = myRiverClientCaller.callAgent('myCustomAgent')({
		onChunk: (chunk) => {
			console.log(chunk);
		}
	});
	const aiSdkAgentCaller = myRiverClientCaller.callAgent('myFirstAgent')({
		onChunk: (chunk) => {
			console.log(chunk);
		}
	});

	const handleTestAiSdkAgent = async () => {
		await aiSdkAgentCaller.start({
			prompt: 'what is the capital of france?'
		});
	};

	const handleTestCustomAgent = async () => {
		await customAgentCaller.start({
			name: 'John Doe'
		});
	};
</script>

<div class="flex flex-col gap-4 p-8">
	<button onclick={handleTestAiSdkAgent} class="rounded-md bg-blue-500 p-2 text-white"
		>Test Ai Sdk Agent</button
	>
	<button onclick={handleTestCustomAgent} class="rounded-md bg-green-500 p-2 text-white"
		>Test Custom Agent</button
	>
</div>
