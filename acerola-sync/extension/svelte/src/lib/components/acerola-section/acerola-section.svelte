<script module lang="ts">
	import type { Snippet } from 'svelte';

	export type AcerolaSectionProps = {
		data: {
			title: string;
			hint?: string | null;
		};
		ui?: {
			class?: string;
		};
		children: Snippet;
		actions?: Snippet;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';

	let { data, ui, children, actions }: AcerolaSectionProps = $props();
</script>

<section class={cn('flex flex-col gap-3', ui?.class)}>
	<header class="flex items-end justify-between gap-2">
		<div class="min-w-0">
			<h2 class="truncate text-lg leading-none font-black tracking-tight">{data.title}</h2>
			{#if data.hint}
				<p class="mt-1 truncate text-xs text-muted-foreground">{data.hint}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex shrink-0 items-center gap-1">{@render actions()}</div>
		{/if}
	</header>
	{@render children()}
</section>
