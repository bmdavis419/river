<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>river</title>
	<meta name="description" content="the tanstack query like experience for consuming streams" />
</svelte:head>

{@render children()}
