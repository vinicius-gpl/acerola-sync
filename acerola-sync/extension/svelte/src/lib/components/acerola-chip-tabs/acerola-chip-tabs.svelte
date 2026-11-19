<script module lang="ts">
	export type AcerolaChipTab = {
		id: string;
		label: string;
		count?: number | null;
	};

	export type AcerolaChipTabsProps = {
		data: {
			items: AcerolaChipTab[];
			active: string;
		};
		events?: {
			onSelect?: (id: string) => void;
		};
		ui?: {
			class?: string;
			size?: 'sm' | 'md';
			label?: string;
		};
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';
	import { slidingIndicator } from '$lib/utils/sliding-indicator.utils';
	import { tick } from 'svelte';

	let { data, events, ui }: AcerolaChipTabsProps = $props();
	const size = $derived(ui?.size ?? 'md');

	let list = $state<HTMLElement>();
	let canStart = $state(false);
	let canEnd = $state(false);

	// More chips hidden on either side? Turn on the fade only on that side.
	function measure() {
		if (!list) return;
		const { scrollLeft, scrollWidth, clientWidth } = list;
		// 2px slack: subpixel rounding must not turn on the fade with nothing hidden.
		canStart = scrollLeft > 2;
		canEnd = scrollLeft + clientWidth < scrollWidth - 2;
	}

	$effect(() => {
		if (!list) return;
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		return () => observer.disconnect();
	});

	$effect(() => {
		void data.items.length;
		void tick().then(measure);
	});

	// The active chip is always visible: if it is outside the scrolled area, scroll to it.
	$effect(() => {
		const active = data.active;
		void tick().then(() => {
			const chip = list?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
			if (!list || !chip) return;
			// Only scrolls the strip horizontally. `scrollIntoView` also scrolled the whole screen
			// vertically (the media opened scrolled, with the actions hidden).
			const start = chip.offsetLeft;
			const end = start + chip.offsetWidth;
			const left =
				start < list.scrollLeft
					? start
					: end > list.scrollLeft + list.clientWidth
						? end - list.clientWidth
						: null;
			if (left !== null) list.scrollTo?.({ left, behavior: 'smooth' });
		});
	});
</script>

<!--
	Chip tabs, with counts. The active chip slides (same action as the reader). The outer frame
	(same color as the track) stays still while the chips scroll inside: the clipped chip
	disappears behind it, instead of the text touching the track's edge.
-->
<div data-chip-frame class={cn('w-fit max-w-full rounded-full bg-surface p-1', ui?.class)}>
	<div
		bind:this={list}
		role="tablist"
		aria-label={ui?.label}
		onscroll={measure}
		data-fade={canStart && canEnd ? 'both' : canStart ? 'start' : canEnd ? 'end' : 'none'}
		class={cn(
			// `relative` must be here: the class is rewritten on every fade change and would wipe
			// the `relative` the sliding indicator sets on its own.
			// `px-px`: a fractional chip width (subpixel) overflowed the strip by ~0.5px and the
			// active pill's edge was cut straight by the `overflow`.
			'relative isolate flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-full px-px',
			canStart && canEnd ? 'fade-x-both' : canStart ? 'fade-x-start' : canEnd && 'fade-x-end'
		)}
		use:slidingIndicator={{
			selector: '[aria-selected="true"]',
			indicatorClass: 'rounded-full bg-foreground'
		}}
	>
		{#each data.items as item (item.id)}
			{@const active = item.id === data.active}
			<button
				type="button"
				role="tab"
				data-chip={item.id}
				aria-selected={active}
				onclick={() => events?.onSelect?.(item.id)}
				class={cn(
					'flex flex-none cursor-pointer items-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
					size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-[13px]',
					active ? 'text-background' : 'text-muted-foreground hover:text-foreground'
				)}
			>
				{item.label}
				{#if item.count !== undefined && item.count !== null}
					<span
						class={cn('text-[10px] tabular-nums', active ? 'opacity-70' : 'opacity-60')}
					>
						{item.count}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
