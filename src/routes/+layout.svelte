<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>river</title>
	<meta name="description" content="the tanstack query like experience for consuming streams" />
</svelte:head>

<div class="flex w-full flex-col bg-background font-geist text-text">
	<div class="flex-1 overflow-hidden">
		{@render children()}
	</div>
</div>
