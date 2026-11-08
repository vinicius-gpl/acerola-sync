<script module lang="ts">
	import type { EntryWithMedia } from '$lib/api/types';

	export type AcerolaSpotlightProps = {
		data: {
			entry: EntryWithMedia;
			/** Etiqueta pequena acima do título (ex.: "Continuar"). */
			eyebrow: string;
			/** Linha de apoio (ex.: "Ep 4 de 12"). */
			caption: string;
		};
		events?: {
			onOpen?: () => void;
			onIncrement?: () => void;
		};
		ui?: {
			class?: string;
			busy?: boolean;
		};
	};
</script>

<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils/cn.utils';
	import { canIncrement, progressPercent } from '$lib/utils/media.utils';
	import { revealIn } from '$lib/utils/motion.utils';

	let { data, events, ui }: AcerolaSpotlightProps = $props();

	const media = $derived(data.entry.media);
	const percent = $derived(progressPercent(data.entry, media) ?? 0);
	const incrementable = $derived(!!events?.onIncrement && canIncrement(data.entry, media));
</script>

<!-- Destaque do topo: a obra que você mexeu por último, com a capa desfocada de fundo. -->
<article
	use:revealIn
	class={cn('relative isolate overflow-hidden rounded-card bg-crust text-on-scrim', ui?.class)}
	data-spotlight
>
	{#if media.coverUrl}
		<img
			src={media.coverUrl}
			alt=""
			class="absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-60 blur-2xl"
		/>
	{/if}
	<div class="absolute inset-0 -z-10 bg-linear-to-r from-scrim/85 via-scrim/60 to-scrim/20"></div>

	<div class="flex items-center gap-4 p-4">
		<button
			type="button"
			class="w-20 flex-none cursor-pointer overflow-hidden rounded-inner shadow-lift"
			onclick={events?.onOpen}
			aria-label={media.titleUserPreferred}
		>
			{#if media.coverUrl}
				<img src={media.coverUrl} alt="" class="aspect-[2/3] w-full object-cover" />
			{:else}
				<span
					class="block aspect-[2/3] w-full"
					style={media.coverColor ? `background-color:${media.coverColor}` : undefined}
				></span>
			{/if}
		</button>

		<div class="flex min-w-0 flex-1 flex-col gap-1.5">
			<span
				class="w-fit max-w-full truncate rounded-full bg-on-scrim/15 px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase backdrop-blur"
			>
				{data.eyebrow}
			</span>
			<h2
				title={media.titleUserPreferred}
				class="line-clamp-2 text-xl leading-[1.05] font-black tracking-tight"
			>
				{media.titleUserPreferred}
			</h2>
			<p class="text-xs text-on-scrim/70">{data.caption}</p>
			<div class="mt-1 h-1.5 w-full rounded-full bg-on-scrim/15">
				<div class="h-full rounded-full bg-primary" style={`width:${percent}%`}></div>
			</div>
		</div>

		{#if incrementable}
			<button
				type="button"
				class="flex size-14 flex-none cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-60"
				disabled={ui?.busy}
				onclick={events?.onIncrement}
				aria-label={m['sync.card.increment']()}
			>
				<!-- "+" desenhado com traço grosso: o "+" da fonte ficava fino perto do "1". -->
				<span class="flex items-center text-2xl leading-none font-black tracking-tighter">
					<PlusIcon size={18} strokeWidth={4} class="-mr-0.5" />1
				</span>
			</button>
		{/if}
	</div>
</article>
