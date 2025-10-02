<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>river</title>
	<meta name="description" content="the tanstack query like experience for consuming streams" />
</svelte:head>

<div class="flex min-h-screen w-full flex-col overflow-hidden bg-background font-geist text-text">
	<div class="flex-1 overflow-auto p-4">
		{@render children()}
	</div>
</div>
