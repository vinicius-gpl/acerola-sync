<script lang="ts">
	import { onMount } from 'svelte';

	let {
		create,
		onReady
	}: {
		create: () => unknown;
		onReady: (hook: unknown) => void;
	} = $props();

	onMount(() => {
		const hook = create();
		onReady(hook);
	});
</script>
