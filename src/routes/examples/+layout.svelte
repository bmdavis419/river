<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	const { children } = $props();

	$effect.pre(() => {
		if (page.route.id !== '/examples/kitchenSink') {
			goto('/examples/kitchenSink');
		}
	});
</script>

<div>
	<nav>
		<a href="/examples/kitchenSink">Kitchen Sink Example</a>
	</nav>
	{@render children()}
</div>
