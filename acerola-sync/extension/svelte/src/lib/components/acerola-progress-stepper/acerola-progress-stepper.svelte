<script module lang="ts">
	export type AcerolaProgressStepperProps = {
		data: {
			value: number;
			/** Total conhecido; sem ele, não há teto. */
			max?: number | null;
			/** Texto sob o número (ex.: "de 12 episódios"). */
			caption?: string | null;
		};
		events?: {
			onChange?: (value: number) => void;
		};
		ui?: {
			class?: string;
			decrementLabel?: string;
			incrementLabel?: string;
		};
	};
</script>

<script lang="ts">
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { cn } from '$lib/utils/cn.utils';
	import { pop } from '$lib/utils/motion.utils';

	let { data, events, ui }: AcerolaProgressStepperProps = $props();

	let number = $state<HTMLElement>();

	const atMin = $derived(data.value <= 0);
	const atMax = $derived(!!data.max && data.value >= data.max);

	function step(delta: number) {
		const next = Math.max(0, data.value + delta);
		const clamped = data.max ? Math.min(data.max, next) : next;
		if (clamped === data.value) return;
		events?.onChange?.(clamped);
		pop(number);
	}
</script>

<div class={cn('flex items-center justify-between gap-3 rounded-tile bg-surface p-2', ui?.class)}>
	<button
		type="button"
		class="flex size-12 cursor-pointer items-center justify-center rounded-full bg-background text-foreground transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
		disabled={atMin}
		onclick={() => step(-1)}
		aria-label={ui?.decrementLabel ?? '-1'}
	>
		<MinusIcon size={18} strokeWidth={3} />
	</button>

	<div class="flex flex-col items-center">
		<span
			bind:this={number}
			class="text-4xl leading-none font-black tracking-tight tabular-nums"
			data-value
		>
			{data.value}
		</span>
		{#if data.caption}
			<span class="mt-1 text-[11px] font-medium text-muted-foreground">{data.caption}</span>
		{/if}
	</div>

	<button
		type="button"
		class="flex size-12 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
		disabled={atMax}
		onclick={() => step(1)}
		aria-label={ui?.incrementLabel ?? '+1'}
	>
		<PlusIcon size={18} strokeWidth={3} />
	</button>
</div>
