<script lang="ts">
	const { children } = $props();
</script>

<div>
	<nav class="flex gap-4">
		<a href="/examples/kitchenSink">Kitchen Sink Example</a>
		<a href="/examples/basic">Basic Example</a>
	</nav>
	{@render children()}
</div>
