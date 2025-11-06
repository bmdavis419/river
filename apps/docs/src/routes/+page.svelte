<script lang="ts">
	import HomeCodeExample from '$lib/components/HomeCodeExample.svelte';
	import { codeToHtml, createHighlighter } from 'shiki/bundle/web';

	const highlighter = await createHighlighter({
		themes: ['github-dark-default'],
		langs: ['typescript', 'svelte']
	});
</script>

<main class="flex grow flex-col items-center justify-center gap-6 px-8">
	<div class="flex flex-row items-center justify-center gap-4">
		<h1 class="m-0 p-0 text-7xl leading-none font-bold text-neutral-100">river</h1>
	</div>
	<p class="text-center text-xl text-neutral-400">trpc, but for ai agents and durable streams...</p>
	<HomeCodeExample {highlighter} />
	<div>
		<a
			href="https://github.com/bmdavis419/river-mono"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2 text-base font-medium text-neutral-50 shadow transition hover:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			github & getting started
		</a>
	</div>
</main>
