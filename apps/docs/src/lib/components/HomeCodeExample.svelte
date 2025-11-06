<script lang="ts">
	import svelteHomeCodeExample from '$lib/assets/svelteHomeCodeExample.txt?raw';
	import type { HighlighterGeneric } from 'shiki';

	const {
		highlighter
	}: {
		highlighter: HighlighterGeneric<any, any>;
	} = $props();

	const svelteCodeHtml = highlighter.codeToHtml(svelteHomeCodeExample, {
		lang: 'svelte',
		theme: 'github-dark-default'
	});
</script>

<div class="code rounded-lg bg-[#0D1117] p-4">
	{@html svelteCodeHtml}
</div>

<style>
	/* Ensure Shiki output doesn't overflow on small screens */
	.code :global(pre.shiki) {
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		margin: 0;
		padding: 0;
		border-radius: 0.5rem;
	}

	.code :global(pre.shiki code) {
		display: inline-block;
		min-width: 100%;
		font-family: var(
			--font-family-geist-mono,
			ui-monospace,
			SFMono-Regular,
			Menlo,
			Monaco,
			Consolas,
			'Liberation Mono',
			'Courier New',
			monospace
		);
		font-size: 0.875rem;
		line-height: 1.5rem;
	}
</style>
