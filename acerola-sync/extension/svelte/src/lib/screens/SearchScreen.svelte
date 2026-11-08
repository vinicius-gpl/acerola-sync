<script lang="ts">
	import type { MediaType, SearchHit } from '$lib/api/types';
	import AcerolaChipTabs from '$lib/components/acerola-chip-tabs/acerola-chip-tabs.svelte';
	import AcerolaEmptyState from '$lib/components/acerola-empty-state/acerola-empty-state.svelte';
	import AcerolaMediaCard from '$lib/components/acerola-media-card/acerola-media-card.svelte';
	import { m } from '$lib/paraglide/messages';
	import { app } from '$lib/state/app.svelte';
	import { statusLabel } from '$lib/utils/labels.utils';
	import { staggerIn } from '$lib/utils/motion.utils';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import { onMount, untrack } from 'svelte';

	let {
		mediaType: fixedType,
		initialQuery = '',
		onPick,
		hideHeader = false
	}: {
		/** Na tela de vincular, o tipo vem do site e não muda. */
		mediaType?: MediaType;
		initialQuery?: string;
		/** Sem `onPick`, clicar abre a obra. */
		onPick?: (hit: SearchHit) => void;
		hideHeader?: boolean;
	} = $props();

	let query = $state(untrack(() => initialQuery));
	let type = $state<string>(untrack(() => fixedType ?? 'ALL'));
	let hits = $state<SearchHit[]>([]);
	let loading = $state(false);
	let searched = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const page = $derived(app.mode === 'page');

	async function run(remote = false) {
		const q = query.trim();
		if (!app.api || !q) {
			hits = [];
			searched = false;
			return;
		}
		loading = true;
		try {
			hits = await app.api.search(q, type === 'ALL' ? undefined : (type as MediaType), remote);
			searched = true;
		} catch (error) {
			await app.handleError(error);
		} finally {
			loading = false;
		}
	}

	// Enquanto digita, só o espelho; o AniList só no botão (1 request).
	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(() => void run(false), 300);
	}

	onMount(() => {
		if (query) void run(false);
	});
</script>

<div class="flex flex-col gap-5">
	{#if !hideHeader}
		<header>
			<p class="text-xs font-semibold text-muted-foreground">{m['sync.search.eyebrow']()}</p>
			<h1 class="leading-none font-black tracking-tighter {page ? 'text-6xl' : 'text-[44px]'}">
				{m['sync.search.title']()}
			</h1>
		</header>
	{/if}

	<label class="flex h-14 items-center gap-3 rounded-full bg-card px-5 shadow-lift">
		<SearchIcon size={20} class="flex-none text-muted-foreground" />
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="search"
			class="h-full min-w-0 flex-1 bg-transparent font-semibold text-base text-foreground outline-none placeholder:text-muted-foreground"
			spellcheck="false"
			autocomplete="off"
			placeholder={m['sync.search.placeholder']()}
			bind:value={query}
			oninput={schedule}
			autofocus
		/>
	</label>

	{#if !fixedType}
		<AcerolaChipTabs
			data={{
				items: [
					{ id: 'ALL', label: m['sync.search.all']() },
					{ id: 'ANIME', label: m['sync.media_type.anime']() },
					{ id: 'MANGA', label: m['sync.media_type.manga']() }
				],
				active: type
			}}
			events={{
				onSelect: (id) => {
					type = id;
					void run(false);
				}
			}}
			ui={{ size: 'sm' }}
		/>
	{/if}

	{#if hits.length}
		<div
			class="grid gap-x-3 gap-y-4 {page
				? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'
				: 'grid-cols-3'}"
			use:staggerIn={{ key: hits.map((hit) => hit.media.id).join() }}
		>
			{#each hits as hit (hit.media.id)}
				<AcerolaMediaCard
					data={{
						media: hit.media,
						entry: hit.entry,
						subtitle: hit.entry
							? statusLabel(hit.entry.status, hit.media.mediaType)
							: [hit.media.format, hit.media.seasonYear].filter(Boolean).join(' · ')
					}}
					events={{
						onOpen: () =>
							onPick ? onPick(hit) : app.push({ name: 'media', mediaId: hit.media.id })
					}}
				/>
			{/each}
		</div>
	{:else if searched && !loading}
		<AcerolaEmptyState
			data={{
				title: m['sync.search.empty'](),
				hint: m['sync.search.empty_hint'](),
				icon: SearchXIcon
			}}
		/>
	{/if}

	{#if query.trim()}
		<button
			type="button"
			class="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-50"
			disabled={loading}
			onclick={() => run(true)}
		>
			<GlobeIcon size={16} />
			{m['sync.search.remote']()}
		</button>
	{/if}
</div>
