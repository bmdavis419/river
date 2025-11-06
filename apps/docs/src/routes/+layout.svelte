<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>river</title>
	<meta name="description" content="trpc, but for ai agents and streams" />
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="font-geist flex min-h-screen flex-col items-center justify-between">
	<header class="flex w-full items-center justify-start gap-2 px-8 py-4"></header>
	{@render children?.()}
	<footer class="py-4"></footer>
</div>
