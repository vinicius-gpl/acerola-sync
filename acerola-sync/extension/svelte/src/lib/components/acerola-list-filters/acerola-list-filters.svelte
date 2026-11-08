<script module lang="ts">
	import type { EntryFacets, EntryFilters, EntrySort } from '$lib/api/types';

	export type AcerolaListFiltersProps = {
		data: {
			value: EntryFilters;
			/** O que existe na lista (gêneros, formatos, anos). `null` enquanto carrega. */
			facets: EntryFacets | null;
		};
		events?: {
			onChange?: (next: EntryFilters) => void;
		};
		ui?: {
			class?: string;
			/** Espera de digitação antes de mandar a busca (ms). */
			debounceMs?: number;
		};
	};

	export const EMPTY_FILTERS: EntryFilters = {
		q: '',
		sort: 'updated',
		formats: [],
		genres: [],
		year: null,
		mediaStatuses: []
	};

	/** Quantos filtros do painel estão ligados (a busca e a ordem não contam). */
	export function activeFilterCount(filters: EntryFilters): number {
		return (
			filters.formats.length +
			filters.genres.length +
			filters.mediaStatuses.length +
			(filters.year === null ? 0 : 1)
		);
	}
</script>

<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils/cn.utils';
	import { formatLabel, mediaStatusLabel } from '$lib/utils/labels.utils';
	import { revealIn } from '$lib/utils/motion.utils';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy } from 'svelte';

	let { data, events, ui }: AcerolaListFiltersProps = $props();

	let open = $state(false);
	let typed = $state('');
	let lastQ: string | undefined;
	// Acompanha a busca de fora (ex.: "limpar" ou troca de tipo) sem atropelar a digitação.
	$effect.pre(() => {
		const q = data.value.q;
		if (q !== lastQ) {
			lastQ = q;
			typed = q;
		}
	});
	let timer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(timer));

	const SORTS: { id: EntrySort; label: () => string }[] = [
		{ id: 'updated', label: m['sync.filters.sort_updated'] },
		{ id: 'title', label: m['sync.filters.sort_title'] },
		{ id: 'score', label: m['sync.filters.sort_score'] },
		{ id: 'progress', label: m['sync.filters.sort_progress'] },
		{ id: 'average', label: m['sync.filters.sort_average'] },
		{ id: 'year', label: m['sync.filters.sort_year'] }
	];

	const MEDIA_STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'HIATUS', 'CANCELLED'];

	const active = $derived(activeFilterCount(data.value));
	const touched = $derived(active > 0 || data.value.sort !== 'updated' || data.value.q !== '');

	function change(patch: Partial<EntryFilters>) {
		events?.onChange?.({ ...data.value, ...patch });
	}

	function toggle(list: string[], item: string) {
		return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
	}

	function onType(value: string) {
		typed = value;
		clearTimeout(timer);
		timer = setTimeout(() => change({ q: value }), ui?.debounceMs ?? 300);
	}

	function clear() {
		clearTimeout(timer);
		typed = '';
		events?.onChange?.({ ...EMPTY_FILTERS });
	}
</script>

{#snippet chip(label: string, selected: boolean, onclick: () => void)}
	<button
		type="button"
		aria-pressed={selected}
		{onclick}
		class={cn(
			'h-8 cursor-pointer rounded-full px-3 text-xs font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
			selected
				? 'bg-foreground text-background'
				: 'bg-surface text-muted-foreground hover:text-foreground'
		)}
	>
		{label}
	</button>
{/snippet}

{#snippet group(title: string)}
	<span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{title}</span>
{/snippet}

<div class={cn('flex flex-col gap-3', ui?.class)}>
	<div class="flex items-center gap-2">
		<label
			class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4 text-muted-foreground focus-within:text-foreground"
		>
			<SearchIcon size={16} class="flex-none" />
			<input
				type="search"
				value={typed}
				oninput={(event) => onType(event.currentTarget.value)}
				placeholder={m['sync.filters.search']()}
				spellcheck="false"
				class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
			/>
		</label>
		<button
			type="button"
			aria-expanded={open}
			aria-label={m['sync.filters.button']()}
			onclick={() => (open = !open)}
			data-filters-toggle
			class={cn(
				'flex h-11 flex-none cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-black transition-colors',
				open || active
					? 'bg-primary text-primary-foreground'
					: 'bg-surface text-foreground hover:bg-mantle'
			)}
		>
			<SlidersIcon size={15} />
			{#if active}
				<span class="tabular-nums" data-filters-count>{active}</span>
			{/if}
		</button>
	</div>

	{#if open}
		<section
			use:revealIn={{ y: -8 }}
			class="flex flex-col gap-4 rounded-card bg-card p-4 shadow-lift"
			data-filters-panel
		>
			<div class="flex flex-col gap-2">
				{@render group(m['sync.filters.sort']())}
				<div class="flex flex-wrap gap-1.5">
					{#each SORTS as sort (sort.id)}
						{@render chip(sort.label(), data.value.sort === sort.id, () =>
							change({ sort: sort.id })
						)}
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-2">
				{@render group(m['sync.filters.media_status']())}
				<div class="flex flex-wrap gap-1.5">
					{#each MEDIA_STATUSES as status (status)}
						{@render chip(mediaStatusLabel(status), data.value.mediaStatuses.includes(status), () =>
							change({ mediaStatuses: toggle(data.value.mediaStatuses, status) })
						)}
					{/each}
				</div>
			</div>

			{#if data.facets?.formats.length}
				<div class="flex flex-col gap-2">
					{@render group(m['sync.filters.format']())}
					<div class="flex flex-wrap gap-1.5">
						{#each data.facets.formats as format (format)}
							{@render chip(formatLabel(format), data.value.formats.includes(format), () =>
								change({ formats: toggle(data.value.formats, format) })
							)}
						{/each}
					</div>
				</div>
			{/if}

			{#if data.facets?.years.length}
				<div class="flex flex-col gap-2">
					{@render group(m['sync.filters.year']())}
					<div class="flex [scrollbar-width:none] gap-1.5 overflow-x-auto rounded-full">
						{#each data.facets.years as year (year)}
							{@render chip(String(year), data.value.year === year, () =>
								change({ year: data.value.year === year ? null : year })
							)}
						{/each}
					</div>
				</div>
			{/if}

			{#if data.facets?.genres.length}
				<div class="flex flex-col gap-2">
					{@render group(m['sync.filters.genre']())}
					<div class="flex flex-wrap gap-1.5">
						{#each data.facets.genres as genre (genre)}
							{@render chip(genre, data.value.genres.includes(genre), () =>
								change({ genres: toggle(data.value.genres, genre) })
							)}
						{/each}
					</div>
				</div>
			{/if}

			{#if touched}
				<button
					type="button"
					onclick={clear}
					class="flex h-10 cursor-pointer items-center justify-center gap-1.5 self-start rounded-full bg-surface px-4 text-xs font-black text-foreground hover:bg-mantle"
				>
					<XIcon size={14} />
					{m['sync.filters.clear']()}
				</button>
			{/if}
		</section>
	{/if}
</div>
