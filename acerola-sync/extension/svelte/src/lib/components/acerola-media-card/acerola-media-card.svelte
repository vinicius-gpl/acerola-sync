<script module lang="ts">
	import type { Entry, Media } from '$lib/api/types';

	export type AcerolaMediaCardProps = {
		data: {
			media: Media;
			entry?: Entry | null;
			/** Linha de baixo do título (ex.: status, formato e ano). */
			subtitle?: string | null;
			/** Selo do canto (ex.: tempo até o próximo episódio). */
			badge?: string | null;
		};
		events?: {
			onOpen?: () => void;
			/** Sem `onIncrement`, o card não mostra o botão de +1. */
			onIncrement?: () => void;
		};
		ui?: {
			class?: string;
			busy?: boolean;
		};
	};
</script>

<script lang="ts">
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import ImageIcon from '@lucide/svelte/icons/image';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils/cn.utils';
	import {
		behindCount,
		canIncrement,
		progressLabel,
		progressPercent
	} from '$lib/utils/media.utils';
	import { pop } from '$lib/utils/motion.utils';
	import { untrack } from 'svelte';

	let { data, events, ui }: AcerolaMediaCardProps = $props();

	let progressChip = $state<HTMLElement>();

	const behind = $derived(data.entry ? behindCount(data.entry, data.media) : 0);
	const incrementable = $derived(
		!!data.entry && !!events?.onIncrement && canIncrement(data.entry, data.media)
	);
	const percent = $derived(data.entry ? progressPercent(data.entry, data.media) : undefined);
	const unit = $derived(
		data.media.mediaType === 'ANIME'
			? m['sync.card.episode_short']()
			: m['sync.card.chapter_short']()
	);

	// O número "pula" quando o progresso muda (depois do +1 salvar).
	let lastProgress = untrack(() => data.entry?.progress);
	$effect(() => {
		const progress = data.entry?.progress;
		if (lastProgress !== undefined && progress !== lastProgress) pop(progressChip);
		lastProgress = progress;
	});
</script>

<article class={cn('group relative flex flex-col gap-2', ui?.class)} data-media-card>
	<div
		class="relative aspect-[2/3] overflow-hidden rounded-tile bg-surface shadow-lift transition-transform duration-300 group-hover:-translate-y-1"
		style={data.media.coverColor ? `background-color:${data.media.coverColor}` : undefined}
	>
		<button
			type="button"
			class="absolute inset-0 cursor-pointer"
			onclick={events?.onOpen}
			aria-label={data.media.titleUserPreferred}
		>
			{#if data.media.coverUrl}
				<img
					src={data.media.coverUrl}
					alt=""
					loading="lazy"
					class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
				/>
			{:else}
				<span class="flex h-full w-full items-center justify-center text-foreground/40">
					<ImageIcon size={28} />
				</span>
			{/if}
		</button>

		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-scrim/70 to-transparent"
		></div>

		{#if data.entry}
			<span
				bind:this={progressChip}
				class="pointer-events-none absolute top-2 left-2 rounded-full bg-scrim/50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-on-scrim uppercase backdrop-blur-md"
			>
				{unit}
				{progressLabel(data.entry, data.media)}
			</span>
		{/if}

		<div class="pointer-events-none absolute top-2 right-2 flex flex-col items-end gap-1">
			{#if behind > 0}
				<span
					class="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground"
				>
					{m['sync.card.behind']({ count: behind })}
				</span>
			{:else if data.badge}
				<span
					class="rounded-full bg-accent-hero px-2 py-0.5 text-[10px] font-bold text-accent-hero-foreground"
				>
					{data.badge}
				</span>
			{/if}
			{#if data.entry?.dirty}
				<span
					class="rounded-full bg-warning-soft p-1 text-warning"
					title={m['sync.card.pending']()}
					aria-label={m['sync.card.pending']()}
				>
					<CloudOffIcon size={11} />
				</span>
			{/if}
		</div>

		{#if percent !== undefined}
			<div
				class="pointer-events-none absolute inset-x-3 bottom-2.5 h-1 rounded-full bg-on-scrim/20"
			>
				<div class="h-full rounded-full bg-primary" style={`width:${percent}%`}></div>
			</div>
		{/if}

		{#if incrementable}
			<button
				type="button"
				class="absolute right-2 bottom-5 flex size-9 translate-y-1 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lift transition-all duration-200 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 hover:scale-110 active:scale-95 disabled:cursor-wait disabled:opacity-60"
				disabled={ui?.busy}
				onclick={events?.onIncrement}
				aria-label={m['sync.card.increment']()}
			>
				<PlusIcon size={20} strokeWidth={3.5} />
			</button>
		{/if}
	</div>

	<div class="min-w-0 px-0.5">
		<h3 class="line-clamp-2 text-[13px] leading-tight font-bold">
			{data.media.titleUserPreferred}
		</h3>
		{#if data.subtitle}
			<p class="mt-0.5 truncate text-[11px] text-muted-foreground">{data.subtitle}</p>
		{/if}
	</div>
</article>
