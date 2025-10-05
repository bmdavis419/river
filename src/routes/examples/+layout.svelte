<script lang="ts">
	const { children } = $props();
</script>

<div class="flex h-screen flex-col">
	<nav class="flex gap-4 p-4">
		<a href="/examples/kitchenSink">Kitchen Sink Example</a>
		<a href="/examples/basic">Basic Example</a>
		<a href="/examples/chat">Chat Example</a>
	</nav>
	<div class="flex-1 overflow-scroll">
		{@render children()}
	</div>
</div>
