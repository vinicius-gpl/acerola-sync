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

	// Tem mais fichas escondidas de algum lado? Liga o fade só nesse lado.
	function measure() {
		if (!list) return;
		const { scrollLeft, scrollWidth, clientWidth } = list;
		canStart = scrollLeft > 1;
		canEnd = scrollLeft + clientWidth < scrollWidth - 1;
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

	// A ficha ativa sempre visível: se ela está fora da área rolada, rola até ela.
	$effect(() => {
		const active = data.active;
		void tick().then(() => {
			const chip = list?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
			chip?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		});
	});
</script>

<!--
	Abas em fichas, com contagem. A ficha ativa desliza (mesma action do reader). A moldura de
	fora (mesma cor da trilha) fica parada enquanto as fichas rolam por dentro: a ficha cortada
	some atrás dela, em vez de o texto encostar na beira da trilha.
-->
<div data-chip-frame class={cn('w-fit max-w-full rounded-full bg-surface p-1', ui?.class)}>
	<div
		bind:this={list}
		role="tablist"
		aria-label={ui?.label}
		onscroll={measure}
		data-fade={canStart && canEnd ? 'both' : canStart ? 'start' : canEnd ? 'end' : 'none'}
		class={cn(
			// `relative` precisa estar aqui: a classe é reescrita a cada troca de fade e apagaria
			// o `relative` que o indicador deslizante põe sozinho.
			'relative isolate flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-full',
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
					<span class={cn('text-[10px] tabular-nums', active ? 'opacity-70' : 'opacity-60')}>
						{item.count}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
