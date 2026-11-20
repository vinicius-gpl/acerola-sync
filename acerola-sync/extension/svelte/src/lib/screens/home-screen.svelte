<script lang="ts">
	import type {
		EntryCount,
		EntryFacets,
		EntryFilters,
		EntryStatus,
		EntryWithMedia,
		MediaType
	} from '$lib/api/types';
	import AcerolaChipTabs from '$lib/components/acerola-chip-tabs/acerola-chip-tabs.svelte';
	import AcerolaListFilters, {
		EMPTY_FILTERS,
		activeFilterCount
	} from '$lib/components/acerola-list-filters/acerola-list-filters.svelte';
	import AcerolaEmptyState from '$lib/components/acerola-empty-state/acerola-empty-state.svelte';
	import AcerolaMediaCard from '$lib/components/acerola-media-card/acerola-media-card.svelte';
	import AcerolaSpotlight from '$lib/components/acerola-spotlight/acerola-spotlight.svelte';
	import AcerolaStatTile from '$lib/components/acerola-stat-tile/acerola-stat-tile.svelte';
	import { m } from '$lib/paraglide/messages';
	import { app } from '$lib/state/app.svelte';
	import { dayPeriod } from '$lib/utils/greeting.utils';
	import { statusLabel } from '$lib/utils/labels.utils';
	import { airedCount, totalUnits } from '$lib/utils/media.utils';
	import { revealIn, staggerIn } from '$lib/utils/motion.utils';
	import { slidingIndicator } from '$lib/utils/sliding-indicator.utils';
	import { BUILT_IN_SITES } from '$lib/tracking/registry';
	import { countdown } from '$lib/utils/time.utils';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	// Tabs by status, like MALSync: you can see what you are following and what you finished.
	const STATUS_ORDER: EntryStatus[] = [
		'CURRENT',
		'COMPLETED',
		'PLANNING',
		'PAUSED',
		'DROPPED',
		'REPEATING'
	];

	let mediaType = $state<MediaType>('ANIME');
	let status = $state<EntryStatus>('CURRENT');
	let entries = $state<EntryWithMedia[]>([]);
	let counts = $state<EntryCount[]>([]);
	let filters = $state<EntryFilters>({ ...EMPTY_FILTERS });
	let facets = $state<EntryFacets | null>(null);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(false);
	let firstPageSize = $state(0);
	let busyIds = $state<number[]>([]);
	let sentinel = $state<HTMLElement>();
	let observer: IntersectionObserver | undefined;

	// Infinite scroll: 48 at a time, the next page when the end of the grid shows up.
	const PAGE_SIZE = 48;

	const page = $derived(app.mode === 'page');
	const countOf = (type: MediaType, which: EntryStatus) =>
		counts.find((item) => item.mediaType === type && item.status === which)?.count ?? 0;
	const tabs = $derived(
		STATUS_ORDER.filter((which) => which !== 'REPEATING' || countOf(mediaType, which) > 0).map(
			(which) => ({
				id: which,
				label: statusLabel(which, mediaType),
				count: countOf(mediaType, which)
			})
		)
	);
	// With a filter or another sort, the first item is not "what you were watching": no highlight.
	const filtering = $derived(
		activeFilterCount(filters) > 0 || filters.q.trim() !== '' || filters.sort !== 'updated'
	);
	const spotlight = $derived(
		status === 'CURRENT' && entries.length && !app.here && !filtering ? entries[0] : null
	);
	const here = $derived(app.here);
	const hereEntry = $derived(
		here?.resolved?.entry ? { ...here.resolved.entry, media: here.resolved.media } : null
	);
	const hereSite = $derived(
		BUILT_IN_SITES.find((site) => site.id === here?.page.site)?.name ?? here?.page.site ?? ''
	);
	const grid = $derived(spotlight ? entries.slice(1) : entries);
	const greeting = $derived(
		{
			morning: m['sync.home.morning'],
			afternoon: m['sync.home.afternoon'],
			night: m['sync.home.night']
		}[dayPeriod()]({ name: app.session?.user.name ?? '' })
	);

	async function loadCounts() {
		try {
			counts = (await app.api?.entryCounts({ mediaType, filters })) ?? [];
		} catch (error) {
			await app.handleError(error);
		}
	}

	async function loadEntries() {
		if (!app.api) return;
		loading = true;
		const requested = { mediaType, status, filters };
		try {
			// Comes from the server mirror (filtered and sorted there): no AniList request spent.
			const page = await app.api.entries({ ...requested, limit: PAGE_SIZE, offset: 0 });
			// Tab or filter changed while loading: the newest response wins.
			if (!sameRequest(requested)) return;
			entries = page;
			firstPageSize = page.length;
			hasMore = page.length === PAGE_SIZE;
		} catch (error) {
			await app.handleError(error);
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!app.api || loading || loadingMore || !hasMore) return;
		loadingMore = true;
		const requested = { mediaType, status, filters };
		try {
			const page = await app.api.entries({
				...requested,
				limit: PAGE_SIZE,
				offset: entries.length
			});
			// Tab changed while loading: discard.
			if (!sameRequest(requested)) return;
			const known = new Set(entries.map((entry) => entry.mediaId));
			entries = [...entries, ...page.filter((entry) => !known.has(entry.mediaId))];
			hasMore = page.length === PAGE_SIZE;
		} catch (error) {
			await app.handleError(error);
		} finally {
			loadingMore = false;
		}
	}

	$effect(() => {
		if (!sentinel || typeof IntersectionObserver === 'undefined') return;
		observer?.disconnect();
		observer = new IntersectionObserver(
			(items) => {
				if (items.some((item) => item.isIntersecting)) void loadMore();
			},
			{ rootMargin: '400px' }
		);
		observer.observe(sentinel);
		return () => observer?.disconnect();
	});
	onDestroy(() => observer?.disconnect());

	function sameRequest(requested: {
		mediaType: MediaType;
		status: EntryStatus;
		filters: EntryFilters;
	}) {
		return (
			requested.mediaType === mediaType &&
			requested.status === status &&
			requested.filters === filters
		);
	}

	async function loadFacets() {
		const type = mediaType;
		try {
			const next = (await app.api?.entryFacets(type)) ?? null;
			if (type === mediaType) facets = next;
		} catch (error) {
			await app.handleError(error);
		}
	}

	function selectType(next: MediaType) {
		if (next === mediaType) return;
		mediaType = next;
		// Genre, format and year change between anime and manga; search and sort stay.
		filters = { ...EMPTY_FILTERS, q: filters.q, sort: filters.sort };
		facets = null;
		void loadFacets();
		void loadCounts();
		void loadEntries();
	}

	function changeFilters(next: EntryFilters) {
		filters = next;
		void loadCounts();
		void loadEntries();
	}

	function selectStatus(next: string) {
		status = next as EntryStatus;
		void loadEntries();
	}

	async function increment(entry: EntryWithMedia) {
		if (!app.api || busyIds.includes(entry.mediaId)) return;
		busyIds = [...busyIds, entry.mediaId];
		try {
			const saved = await app.api.updateEntry(entry.mediaId, {
				progress: entry.progress + 1
			});
			if (saved.pending) toast.warning(m['sync.home.savedPending']());
			if (saved.status === status) {
				entries = entries.map((item) => (item.mediaId === saved.mediaId ? saved : item));
			} else {
				entries = entries.filter((item) => item.mediaId !== saved.mediaId);
				toast.success(
					m['sync.home.moved']({ status: statusLabel(saved.status, mediaType) })
				);
				void loadCounts();
			}
		} catch (error) {
			await app.handleError(error);
		} finally {
			busyIds = busyIds.filter((id) => id !== entry.mediaId);
		}
	}

	function caption(entry: EntryWithMedia) {
		const total = totalUnits(entry.media);
		const base =
			entry.media.mediaType === 'ANIME'
				? m['sync.home.caption.episode']({ progress: entry.progress, total: total ?? '?' })
				: m['sync.home.caption.chapter']({ progress: entry.progress, total: total ?? '?' });
		const aired = airedCount(entry.media);
		return aired ? m['sync.home.caption.aired']({ caption: base, aired }) : base;
	}

	function subtitle(entry: EntryWithMedia) {
		if (entry.score > 0) return `★ ${entry.score}`;
		return [entry.media.format, entry.media.seasonYear].filter(Boolean).join(' · ');
	}

	function badge(entry: EntryWithMedia) {
		const left = countdown(entry.media.nextAiringAt);
		return left && entry.media.nextAiringEpisode
			? m['sync.home.airing.badge']({ episode: entry.media.nextAiringEpisode, time: left })
			: null;
	}

	onMount(() => {
		void loadCounts();
		void loadEntries();
		void loadFacets();
	});
</script>

<div class="flex flex-col gap-5">
	<header class="flex flex-col gap-1">
		<p class="text-xs font-semibold text-muted-foreground">{greeting}</p>
		<!--
			The two big words are the type tabs: the active one is solid, with a bar underneath
			that slides on switch; the other is dimmed and lights up on hover, so it reads as clickable.
		-->
		<div
			class="isolate flex items-baseline gap-4 self-start pb-2.5"
			role="tablist"
			aria-label={m['sync.home.type.label']()}
			use:slidingIndicator={{
				selector: '[aria-selected="true"]',
				indicatorClass: 'top-auto bottom-0 h-1.5 rounded-full bg-primary',
				track: ['x', 'width']
			}}
		>
			{#each ['ANIME', 'MANGA'] as const as type (type)}
				<button
					type="button"
					role="tab"
					aria-selected={mediaType === type}
					onclick={() => selectType(type)}
					class="cursor-pointer leading-none font-black tracking-tighter transition-colors {page
						? 'text-6xl'
						: 'text-[44px]'} {mediaType === type
						? 'text-foreground'
						: 'text-muted-foreground/40 hover:text-muted-foreground/80'}"
				>
					{type === 'ANIME' ? m['sync.media.type.anime']() : m['sync.media.type.manga']()}
				</button>
			{/each}
		</div>
	</header>

	{#if page}
		<div class="grid grid-cols-4 gap-3" use:staggerIn={{ key: mediaType }}>
			<AcerolaStatTile
				data={{
					label: statusLabel('CURRENT', mediaType),
					value: countOf(mediaType, 'CURRENT') + countOf(mediaType, 'REPEATING')
				}}
				ui={{ tone: 'primary' }}
			/>
			<AcerolaStatTile
				data={{
					label: statusLabel('COMPLETED', mediaType),
					value: countOf(mediaType, 'COMPLETED')
				}}
				ui={{ tone: 'success' }}
			/>
			<AcerolaStatTile
				data={{
					label: statusLabel('PLANNING', mediaType),
					value: countOf(mediaType, 'PLANNING')
				}}
				ui={{ tone: 'info' }}
			/>
			<AcerolaStatTile
				data={{
					label: m['sync.home.onHold'](),
					value: countOf(mediaType, 'PAUSED') + countOf(mediaType, 'DROPPED')
				}}
				ui={{ tone: 'warning' }}
			/>
		</div>
	{/if}

	<AcerolaChipTabs
		data={{ items: tabs, active: status }}
		events={{ onSelect: selectStatus }}
		ui={{ label: m['sync.home.status.label']() }}
	/>

	<AcerolaListFilters data={{ value: filters, facets }} events={{ onChange: changeFilters }} />

	{#if here}
		{#if hereEntry}
			<AcerolaSpotlight
				data={{
					entry: hereEntry,
					eyebrow: m['sync.home.here.label']({ site: hereSite }),
					caption: caption(hereEntry)
				}}
				events={{
					onOpen: () => app.push({ name: 'media', mediaId: hereEntry.mediaId }),
					onIncrement: () => increment(hereEntry)
				}}
				ui={{ busy: busyIds.includes(hereEntry.mediaId) }}
			/>
		{:else}
			<section
				use:revealIn
				class="flex items-center gap-4 rounded-card bg-card p-4"
				data-here
			>
				{#if here.resolved?.media.coverUrl}
					<img
						src={here.resolved.media.coverUrl}
						alt=""
						class="h-24 w-16 flex-none rounded-inner object-cover shadow-lift"
					/>
				{/if}
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<span
						class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
					>
						{m['sync.home.here.label']({ site: hereSite })}
					</span>
					<p class="line-clamp-2 text-lg leading-tight font-black tracking-tight">
						{here.resolved?.media.titleUserPreferred ?? here.page.title}
					</p>
					<p class="text-xs text-muted-foreground">
						{here.resolved
							? m['sync.home.here.notListed']()
							: m['sync.home.here.notFound']()}
					</p>
				</div>
				{#if here.resolved}
					<button
						type="button"
						class="h-10 flex-none cursor-pointer rounded-full bg-primary px-4 text-xs font-black text-primary-foreground"
						onclick={() =>
							here.resolved &&
							app.push({ name: 'media', mediaId: here.resolved.media.id })}
					>
						{m['sync.home.here.open']()}
					</button>
				{:else}
					<button
						type="button"
						class="flex h-10 flex-none cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-black text-primary-foreground"
						onclick={() =>
							app.push({
								name: 'link',
								request: {
									site: here.page.site,
									identifier: here.page.identifier,
									title: here.page.title,
									mediaType: here.page.mediaType
								}
							})}
					>
						<LinkIcon size={14} />
						{m['sync.home.here.link']()}
					</button>
				{/if}
			</section>
		{/if}
	{/if}

	{#if spotlight}
		<AcerolaSpotlight
			data={{
				entry: spotlight,
				eyebrow: m['sync.home.continue'](),
				caption: caption(spotlight)
			}}
			events={{
				onOpen: () => app.push({ name: 'media', mediaId: spotlight.mediaId }),
				onIncrement: () => increment(spotlight)
			}}
			ui={{ busy: busyIds.includes(spotlight.mediaId) }}
		/>
	{/if}

	{#if !loading && entries.length === 0}
		<AcerolaEmptyState
			data={{
				title: filtering
					? m['sync.filters.empty']()
					: m['sync.home.empty.label']({
							status: statusLabel(status, mediaType).toLowerCase()
						}),
				hint: m['sync.home.empty.hint']()
			}}
		/>
	{/if}

	<div
		class="grid gap-x-3 gap-y-4 {page
			? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'
			: 'grid-cols-3'}"
		use:staggerIn={{ key: `${mediaType}-${status}-${JSON.stringify(filters)}-${loading}` }}
	>
		{#each grid as entry, index (entry.mediaId)}
			<!-- The first page cascades in; the next ones card by card as they arrive. -->
			<div use:revealIn={{ y: 16, skip: index < firstPageSize }}>
				<AcerolaMediaCard
					data={{
						media: entry.media,
						entry,
						subtitle: subtitle(entry),
						badge: badge(entry)
					}}
					events={{
						onOpen: () => app.push({ name: 'media', mediaId: entry.mediaId }),
						onIncrement:
							entry.status === 'CURRENT' || entry.status === 'REPEATING'
								? () => increment(entry)
								: undefined
					}}
					ui={{ busy: busyIds.includes(entry.mediaId) }}
				/>
			</div>
		{/each}
	</div>

	{#if hasMore}
		<div bind:this={sentinel} class="flex justify-center py-4" data-sentinel>
			{#if loadingMore}
				<LoaderIcon size={20} class="animate-spin text-primary" />
			{/if}
		</div>
	{/if}
</div>
