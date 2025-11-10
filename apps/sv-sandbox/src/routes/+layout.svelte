<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="">
	<nav class="flex gap-4 p-8">
		<a href="/">Basic</a>
		<a href="/redis">Redis Resume Stream</a>
	</nav>
	{@render children()}
</div>
