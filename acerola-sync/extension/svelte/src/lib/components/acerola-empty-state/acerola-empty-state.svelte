<script module lang="ts">
	import type { Component, Snippet } from 'svelte';

	export type AcerolaEmptyStateProps = {
		data: {
			title: string;
			hint?: string | null;
			icon?: Component<{ size?: number }>;
		};
		ui?: {
			class?: string;
		};
		action?: Snippet;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';
	import { revealIn } from '$lib/utils/motion.utils';

	let { data, ui, action }: AcerolaEmptyStateProps = $props();
</script>

<div use:revealIn class={cn('flex flex-col items-center gap-2 py-10 text-center', ui?.class)}>
	{#if data.icon}
		<span
			class="mb-1 flex size-14 items-center justify-center rounded-full bg-surface text-muted-foreground"
		>
			<data.icon size={24} />
		</span>
	{/if}
	<p class="font-black tracking-tight text-base">{data.title}</p>
	{#if data.hint}
		<p class="max-w-64 text-xs text-muted-foreground">{data.hint}</p>
	{/if}
	{#if action}
		<div class="mt-2">{@render action()}</div>
	{/if}
</div>
