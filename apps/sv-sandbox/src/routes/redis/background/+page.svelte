<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		remoteResumeUnreliableStream,
		remoteRunUnreliableStream,
		remoteStartUnreliableStreamInBg
	} from '$lib/demo.remote';

	let prompt = $state(
		'What is the difference between typescript and javascript? Give a brief answer'
	);
	const trimmedPrompt = $derived(prompt.trim());

	let isRunning = $state(false);

	let resumeLink = $state<string | null>(null);
	let resumeKey = $state<string | null>(null);

	const handleResumeStreamOnServer = async () => {
		if (!resumeKey) {
			console.error('No resume key');
			return;
		}
		const result = await remoteResumeUnreliableStream({
			resumeKey
		});

		console.log('Resume stream on server result:', result);
	};

	const handleStartStreamOnlyOnServer = async () => {
		isRunning = true;
		const {
			totalLetters,
			totalVowels,
			resumeKey: newResumeKey
		} = await remoteRunUnreliableStream({
			prompt: trimmedPrompt
		});

		console.log('Total letters:', totalLetters, 'Total vowels:', totalVowels);
		isRunning = false;
		if (newResumeKey) {
			resumeKey = newResumeKey;
			resumeLink = `/redis?resumeKey=${encodeURIComponent(newResumeKey)}`;
		}
	};

	const handleStartStream = async () => {
		const { resumeKey } = await remoteStartUnreliableStreamInBg({
			prompt: trimmedPrompt
		});

		if (!resumeKey) {
			console.error('No resume key');
			return;
		}

		goto(`/redis?resumeKey=${encodeURIComponent(resumeKey)}`);
	};
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-4 p-8">
	<h2 class="text-2xl font-bold">Background Stream Demo</h2>
	<textarea
		bind:value={prompt}
		placeholder="Type your message..."
		class="min-h-32 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 placeholder:text-neutral-500 focus:border-transparent focus:ring-2 focus:ring-primary focus:outline-none"
	></textarea>

	{#if isRunning}
		<p>Running...</p>
	{/if}

	<div class="flex items-center justify-end gap-2">
		<button
			onclick={handleStartStreamOnlyOnServer}
			disabled={!trimmedPrompt || isRunning}
			class="self-end rounded-lg bg-primary px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 {isRunning
				? 'cursor-not-allowed opacity-50'
				: ''}"
		>
			Start Stream Only on Server...
		</button>
		<button
			onclick={handleStartStream}
			disabled={!trimmedPrompt}
			class="self-end rounded-lg bg-primary px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Start Stream in Background...
		</button>
		{#if resumeKey}
			<button
				onclick={handleResumeStreamOnServer}
				disabled={!resumeKey}
				class="self-end rounded-lg bg-primary px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Resume Stream on Server
			</button>
		{/if}
		{#if resumeLink}
			<a
				href={resumeLink}
				target="_blank"
				class="self-end rounded-lg bg-primary px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Resume Stream
			</a>
		{/if}
	</div>
</div>
