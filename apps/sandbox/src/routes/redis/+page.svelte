<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { myRiverClient } from '$lib/river/client';
	import type { RiverChunkType } from '@davis7dotsh/river-adapter-sveltekit';
	import { onMount } from 'svelte';

	let message = $state(
		'What is the difference between typescript and javascript? Give a brief answer'
	);

	const trimmedMessage = $derived(message.trim());

	type ChunkType = RiverChunkType<typeof myRiverClient.basic>;

	let allChunks = $state<ChunkType[]>([]);

	const basicCaller = myRiverClient.redisResume({
		onChunk: (chunk) => {
			allChunks.push(chunk);
		},
		onStart: () => {
			allChunks = [];
		},
		onEnd: (data) => {
			console.log('Finished first stream', data.totalChunks, data.totalTimeMs);
		},
		onError: (error) => {
			console.error(error);
		},
		onAbort: () => {
			console.log('Aborted stream');
		},
		onStreamInfo: ({ encodedResumptionToken }) => {
			if (encodedResumptionToken) {
				goto(`?resumeKey=${encodeURIComponent(encodedResumptionToken)}`);
			}
		}
	});

	onMount(() => {
		const urlResumeKey = page.url.searchParams.get('resumeKey');
		if (urlResumeKey) {
			basicCaller.resume(urlResumeKey);
		}
	});

	const handleAbort = () => {
		basicCaller.abort();
	};

	const handleSendMessage = () => {
		if (trimmedMessage) {
			basicCaller.start({
				prompt: trimmedMessage
			});
		}
	};
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-8">
	<h2 class="text-2xl font-bold">Redis Resume Stream</h2>
	<textarea
		bind:value={message}
		placeholder="Type your message..."
		class="min-h-32 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:border-transparent focus:ring-2 focus:ring-primary focus:outline-none"
	></textarea>
	<div class="flex items-center justify-end gap-2">
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
		<button
			onclick={() => {
				goto('?');
			}}
			class="self-end rounded-lg bg-primary px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Clear URL
		</button>

		<button
			onclick={() => {
				goto('/redis/background');
			}}
			class="self-end rounded-lg bg-primary px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Background Stream Demo
		</button>
	</div>
	<ul>
		{#each allChunks as chunk}
			<li>{chunk.isVowel ? 'Vowel' : 'Consonant'} {chunk.letter}</li>
		{/each}
	</ul>
</div>
