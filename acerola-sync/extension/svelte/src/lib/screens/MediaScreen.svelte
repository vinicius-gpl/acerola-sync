<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import {
		ENTRY_STATUSES,
		type CustomSite,
		type Entry,
		type EntryStatus,
		type LastVisit,
		type Media
	} from '$lib/api/types';
	import AcerolaChipTabs from '$lib/components/acerola-chip-tabs/acerola-chip-tabs.svelte';
	import AcerolaConfirmDialog from '$lib/components/acerola-confirm-dialog/acerola-confirm-dialog.svelte';
	import AcerolaSiteIcon from '$lib/components/acerola-site-icon/acerola-site-icon.svelte';
	import AcerolaProgressStepper from '$lib/components/acerola-progress-stepper/acerola-progress-stepper.svelte';
	import AcerolaStatTile from '$lib/components/acerola-stat-tile/acerola-stat-tile.svelte';
	import { m } from '$lib/paraglide/messages';
	import { app } from '$lib/state/app.svelte';
	import { STORAGE_KEYS } from '$lib/constants/storage-keys';
	import {
		formatLabel,
		humanizeEnum,
		mediaStatusLabel,
		mediaTypeLabel,
		relationLabel,
		seasonLabel,
		statusLabel
	} from '$lib/utils/labels.utils';
	import { totalUnits } from '$lib/utils/media.utils';
	import { revealIn, spinWhile, staggerIn } from '$lib/utils/motion.utils';
	import { countdown } from '$lib/utils/time.utils';
	import { watchLinks } from '$lib/utils/watch-links.utils';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { storage } from 'wxt/utils/storage';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let { mediaId }: { mediaId: number } = $props();

	let media = $state<Media | null>(null);
	let entry = $state<Entry | null>(null);
	let status = $state<EntryStatus>('PLANNING');
	let progress = $state(0);
	let score = $state(0);
	let saving = $state(false);
	let expanded = $state(false);
	let confirmRemove = $state({ open: false });
	let visits = $state<LastVisit[]>([]);
	let customSites = $state<CustomSite[]>([]);
	let syncing = $state(false);
	let titleOpen = $state(false);

	const total = $derived(media ? totalUnits(media) : null);
	const changed = $derived(
		!entry || entry.status !== status || entry.progress !== progress || entry.score !== score
	);
	const statusTabs = $derived(
		media ? ENTRY_STATUSES.map((id) => ({ id, label: statusLabel(id, media!.mediaType) })) : []
	);
	const description = $derived(media?.description?.replace(/<[^>]+>/g, '').trim() ?? '');
	// Mangá com formato "MANGA" daria "Mangá" duas vezes (e chave repetida derruba o `each`).
	const chips = $derived(
		media
			? [
					...new Set(
						[
							mediaTypeLabel(media.mediaType),
							media.format && formatLabel(media.format),
							String(media.seasonYear ?? media.startYear ?? '')
						].filter(Boolean)
					)
				]
			: []
	);
	const links = $derived(media ? watchLinks(media, visits, customSites) : []);
	const otherLinks = $derived(
		(media?.externalLinks ?? []).filter((link) => link.kind !== 'STREAMING')
	);
	const unit = (number: number) =>
		media?.mediaType === 'ANIME'
			? m['sync.tracking.episode']({ number })
			: m['sync.tracking.chapter']({ number });

	// Datas do AniList são dia de calendário: formata sem fuso para não virar o dia anterior.
	const dateFormat = new Intl.DateTimeFormat(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const formatDate = (value: string | null | undefined) =>
		value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : null;

	const info = $derived.by(() => {
		if (!media) return [];
		const rows: [string, string | null | undefined][] = [
			[m['sync.media.info_format'](), media.format && formatLabel(media.format)],
			[
				media.mediaType === 'ANIME'
					? m['sync.media.episodes_label']()
					: m['sync.media.chapters_label'](),
				total ? String(total) : null
			],
			[m['sync.media.info_volumes'](), media.volumes ? String(media.volumes) : null],
			[
				m['sync.media.info_duration'](),
				media.duration ? m['sync.media.duration_value']({ minutes: media.duration }) : null
			],
			[m['sync.media.info_status'](), media.status && mediaStatusLabel(media.status)],
			[m['sync.media.info_start'](), formatDate(media.startDate)],
			[m['sync.media.info_end'](), formatDate(media.endDate)],
			[
				m['sync.media.info_season'](),
				media.season ? `${seasonLabel(media.season)} ${media.seasonYear ?? ''}`.trim() : null
			],
			[m['sync.media.info_studios'](), media.studios?.join(', ')],
			[m['sync.media.info_source'](), media.source && humanizeEnum(media.source)],
			[m['sync.media.info_synonyms'](), media.synonyms.slice(0, 3).join(' · ')]
		];
		return rows.filter((row): row is [string, string] => !!row[1]);
	});

	function fill(next: Entry | null) {
		entry = next;
		status = next?.status ?? 'PLANNING';
		progress = next?.progress ?? 0;
		score = next?.score ?? 0;
	}

	onMount(async () => {
		// Sites personalizados (para "abrir no site"): o que o app já guardou ao entrar.
		void (async () => {
			try {
				customSites = (await storage.getItem<CustomSite[]>(STORAGE_KEYS.customSites)) ?? [];
			} catch {
				customSites = [];
			}
		})();
		try {
			const detail = await app.api!.media(mediaId);
			media = detail.media;
			visits = detail.visits ?? [];
			fill(detail.entry);
		} catch (error) {
			await app.handleError(error);
		}
	});

	async function syncNow() {
		if (!app.api || syncing) return;
		syncing = true;
		try {
			const detail = await app.api.syncEntry(mediaId);
			media = detail.media;
			visits = detail.visits ?? [];
			fill(detail.entry);
			if (detail.entry?.dirty) toast.warning(m['sync.home.saved_pending']());
			else toast.success(m['sync.media.synced']());
		} catch (error) {
			await app.handleError(error);
		} finally {
			syncing = false;
		}
	}

	function changeProgress(next: number) {
		progress = next;
		// Mexer no progresso de algo planejado já conta como começar, como no AniList.
		if (status === 'PLANNING' && next > 0) status = 'CURRENT';
		if (total && next >= total) status = 'COMPLETED';
	}

	async function save() {
		if (!app.api) return;
		saving = true;
		try {
			const saved = await app.api.updateEntry(mediaId, { status, progress, score });
			fill(saved);
			if (saved.pending) toast.warning(m['sync.home.saved_pending']());
			else toast.success(m['sync.media.saved']());
		} catch (error) {
			await app.handleError(error);
		} finally {
			saving = false;
		}
	}

	async function remove() {
		// O "Remover" do diálogo não fecha sozinho (bits-ui); sem isso a tela ficava presa.
		confirmRemove = { open: false };
		if (!app.api) return;
		try {
			await app.api.deleteEntry(mediaId);
			fill(null);
			toast.success(m['sync.media.removed']());
		} catch (error) {
			// Já tinha saído da lista (outro dispositivo, outro clique): o resultado é o mesmo.
			if (error instanceof ApiError && error.status === 404) fill(null);
			else await app.handleError(error);
		}
	}
</script>

<div class="flex flex-col gap-5 pb-4">
	<div class="flex items-center">
		<button
			type="button"
			class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface transition-transform hover:scale-105"
			onclick={() => app.back()}
			aria-label={m['sync.common.back']()}
		>
			{#if app.mode === 'page'}<XIcon size={18} />{:else}<ArrowLeftIcon size={18} />{/if}
		</button>
		<div class="flex-1"></div>
		{#if media}
			<button
				type="button"
				class="mr-2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface transition-transform hover:scale-105 disabled:cursor-wait"
				onclick={syncNow}
				disabled={syncing}
				aria-label={m['sync.media.sync']()}
				title={m['sync.media.sync']()}
				data-sync-entry
			>
				<span class="flex" use:spinWhile={syncing}><RefreshIcon size={16} /></span>
			</button>
		{/if}
		{#if media?.siteUrl}
			<a
				href={media.siteUrl}
				target="_blank"
				rel="noreferrer"
				class="flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-xs font-bold transition-transform hover:scale-105"
			>
				AniList <ExternalLinkIcon size={14} />
			</a>
		{/if}
	</div>

	{#if media}
		<section use:revealIn class="relative">
			<div
				class="relative h-40 overflow-hidden rounded-card bg-crust"
				style={media.coverColor ? `background-color:${media.coverColor}` : undefined}
			>
				{#if media.bannerUrl ?? media.coverUrl}
					<img
						src={media.bannerUrl ?? media.coverUrl}
						alt=""
						class="h-full w-full object-cover {media.bannerUrl ? '' : 'scale-125 blur-2xl'}"
					/>
				{/if}
				<div class="absolute inset-0 bg-linear-to-t from-scrim/70 to-transparent"></div>
			</div>
			<div class="-mt-16 flex items-end gap-4 px-4">
				{#if media.coverUrl}
					<img
						src={media.coverUrl}
						alt=""
						class="relative h-36 w-24 flex-none rounded-inner object-cover shadow-lift"
						style={media.coverColor ? `background-color:${media.coverColor}` : undefined}
					/>
				{:else}
					<!-- Sem capa: bloco liso em vez do ícone de imagem quebrada do navegador. -->
					<div
						class="relative h-36 w-24 flex-none rounded-inner bg-surface shadow-lift"
						style={media.coverColor ? `background-color:${media.coverColor}` : undefined}
					></div>
				{/if}
				<div class="flex min-w-0 flex-wrap gap-1.5 pb-1">
					{#each chips as chip (chip)}
						<span class="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold">{chip}</span>
					{/each}
				</div>
			</div>
		</section>

		<div>
			<!-- Título longo fica em 3 linhas; um toque mostra inteiro. -->
			<button
				type="button"
				class="block w-full cursor-pointer text-left"
				onclick={() => (titleOpen = !titleOpen)}
				title={media.titleUserPreferred}
			>
				<h1
					class="leading-[1.02] font-black tracking-tighter break-words {media.titleUserPreferred
						.length > 60
						? 'text-2xl'
						: 'text-3xl'} {titleOpen ? '' : 'line-clamp-3'}"
				>
					{media.titleUserPreferred}
				</h1>
			</button>
			{#if media.titleEnglish && media.titleEnglish !== media.titleUserPreferred}
				<p class="mt-1 line-clamp-2 text-sm text-muted-foreground" title={media.titleEnglish}>
					{media.titleEnglish}
				</p>
			{/if}
			{#if media.genres.length}
				<p class="mt-2 text-xs font-semibold text-muted-foreground">{media.genres.join(' · ')}</p>
			{/if}
		</div>

		<div class="grid grid-cols-3 gap-2" use:staggerIn>
			<AcerolaStatTile
				data={{ label: m['sync.media.average'](), value: media.averageScore ?? '—', hint: '%' }}
				ui={{ tone: 'primary' }}
			/>
			<AcerolaStatTile
				data={{
					label:
						media.mediaType === 'ANIME'
							? m['sync.media.episodes_label']()
							: m['sync.media.chapters_label'](),
					value: total ?? '?'
				}}
				ui={{ tone: 'info' }}
			/>
			{#if media.nextAiringEpisode && countdown(media.nextAiringAt)}
				<AcerolaStatTile
					data={{
						label: m['sync.media.next_label']({ episode: media.nextAiringEpisode }),
						value: countdown(media.nextAiringAt) ?? ''
					}}
					ui={{ tone: 'success' }}
				/>
			{:else}
				<AcerolaStatTile
					data={{ label: m['sync.media.score_label'](), value: entry?.score || '—' }}
					ui={{ tone: 'success' }}
				/>
			{/if}
		</div>

		<section class="flex flex-col gap-3 rounded-card bg-card p-4">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-black tracking-tight">{m['sync.media.your_list']()}</h2>
				{#if entry?.dirty}
					<span
						class="flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-bold text-warning"
						title={entry.lastPushError ?? ''}
					>
						<CloudOffIcon size={12} />
						{m['sync.card.pending']()}
					</span>
				{/if}
			</div>

			<AcerolaChipTabs
				data={{ items: statusTabs, active: status }}
				events={{ onSelect: (id) => (status = id as EntryStatus) }}
				ui={{ size: 'sm', label: m['sync.media.status']() }}
			/>

			<AcerolaProgressStepper
				data={{
					value: progress,
					max: total,
					caption: total
						? m['sync.media.of_total']({ total })
						: media.mediaType === 'ANIME'
							? m['sync.media.episodes_label']()
							: m['sync.media.chapters_label']()
				}}
				events={{ onChange: changeProgress }}
			/>

			<label class="flex items-center justify-between gap-3 rounded-tile bg-surface px-4 py-2.5">
				<span class="text-sm font-bold">{m['sync.media.score']()}</span>
				<input
					type="range"
					min="0"
					max="100"
					step="5"
					bind:value={score}
					class="flex-1 accent-primary"
					aria-label={m['sync.media.score']()}
				/>
				<span class="w-8 text-right text-sm font-black tabular-nums">{score}</span>
			</label>

			<button
				type="button"
				class="h-12 cursor-pointer rounded-full bg-primary text-sm font-black text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				disabled={saving || !changed}
				onclick={save}
			>
				{entry ? m['sync.media.save']() : m['sync.media.add']()}
			</button>
			{#if entry}
				<button
					type="button"
					class="cursor-pointer text-xs font-bold text-destructive hover:underline"
					onclick={() => (confirmRemove = { open: true })}
				>
					{m['sync.media.remove']()}
				</button>
			{/if}
		</section>

		{#if links.length}
			<section class="flex flex-col gap-3" data-watch-links>
				<h2 class="text-lg font-black tracking-tight">
					{media.mediaType === 'ANIME'
						? m['sync.media.watch_anime']()
						: m['sync.media.watch_manga']()}
				</h2>
				<div class="flex flex-col gap-2" use:staggerIn>
					{#each links as link (link.key)}
						<a
							href={link.url}
							target="_blank"
							rel="noreferrer"
							class="flex items-center gap-3 rounded-tile bg-card p-2.5 pr-4 transition-colors hover:bg-surface"
						>
							<AcerolaSiteIcon
								data={{ name: link.name, url: link.homepage }}
								ui={{ class: 'size-10' }}
							/>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate text-sm font-black">{link.name}</span>
								<span class="truncate text-xs text-muted-foreground">
									{#if link.kind === 'continue' && link.progress}
										{m['sync.media.continue_at']({ unit: unit(link.progress) })}
									{:else if link.kind === 'streaming'}
										{m['sync.media.official']()}
									{:else}
										{m['sync.media.search_on']()}
									{/if}
								</span>
							</span>
							<span
								class="grid size-10 flex-none place-items-center rounded-full {link.kind ===
								'search'
									? 'bg-surface text-foreground'
									: 'bg-primary text-primary-foreground'}"
							>
								<!-- Ícone cheio e traço grosso: o fino sumia dentro da bolinha. -->
								{#if link.kind === 'search'}
									<SearchIcon size={16} strokeWidth={3} />
								{:else}
									<!-- Triângulo centrado pelo centro de massa (12,12), não pela caixa: o
									     play do Lucide parecia torto dentro da bolinha. -->
									<svg
										viewBox="0 0 24 24"
										class="size-5"
										fill="currentColor"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M8 4.5 19.5 12 8 19.5Z" />
									</svg>
								{/if}
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if info.length}
			<section class="flex flex-col gap-3 rounded-card bg-card p-4" data-media-info>
				<h2 class="text-lg font-black tracking-tight">{m['sync.media.info']()}</h2>
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					{#each info as [label, value] (label)}
						<dt class="font-bold text-muted-foreground">{label}</dt>
						<dd class="min-w-0 font-semibold break-words">{value}</dd>
					{/each}
				</dl>
			</section>
		{/if}

		{#if description}
			<section class="flex flex-col gap-2">
				<h2 class="text-lg font-black tracking-tight">{m['sync.media.synopsis']()}</h2>
				<p
					class="text-sm leading-relaxed whitespace-pre-line text-muted-foreground {expanded
						? ''
						: 'line-clamp-4'}"
				>
					{description}
				</p>
				<button
					type="button"
					class="w-fit cursor-pointer text-xs font-bold text-primary"
					onclick={() => (expanded = !expanded)}
				>
					{expanded ? m['sync.media.less']() : m['sync.media.more']()}
				</button>
			</section>
		{/if}
		{#if media.relations?.length}
			<section class="flex flex-col gap-3" data-relations>
				<h2 class="text-lg font-black tracking-tight">{m['sync.media.related']()}</h2>
				<div class="flex flex-col gap-2">
					{#each media.relations as relation, index (`${index}:${relation.id}`)}
						<button
							type="button"
							class="flex cursor-pointer items-center gap-3 rounded-tile bg-card p-2 pr-4 text-left transition-colors hover:bg-surface"
							onclick={() => app.push({ name: 'media', mediaId: relation.id })}
						>
							{#if relation.coverUrl}
								<img
									src={relation.coverUrl}
									alt=""
									class="h-16 w-11 flex-none rounded-inner object-cover"
								/>
							{:else}
								<span class="h-16 w-11 flex-none rounded-inner bg-surface"></span>
							{/if}
							<span class="flex min-w-0 flex-col">
								<span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
									{relationLabel(relation.relationType)} · {relation.format
										? formatLabel(relation.format)
										: mediaTypeLabel(relation.mediaType)}
								</span>
								<span class="line-clamp-2 text-sm font-black" title={relation.title}
									>{relation.title}</span
								>
							</span>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		{#if otherLinks.length}
			<section class="flex flex-col gap-3">
				<h2 class="text-lg font-black tracking-tight">{m['sync.media.links']()}</h2>
				<div class="flex flex-wrap gap-1.5">
					{#each otherLinks as link, index (`${index}:${link.url}`)}
						<a
							href={link.url}
							target="_blank"
							rel="noreferrer"
							class="flex h-8 max-w-full items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold transition-colors hover:bg-mantle"
						>
							<span class="truncate">{link.site}</span>
							<ExternalLinkIcon size={12} class="flex-none" />
						</a>
					{/each}
				</div>
			</section>
		{/if}
	{:else}
		<div class="h-40 animate-pulse rounded-card bg-surface"></div>
		<div class="h-8 w-2/3 animate-pulse rounded-full bg-surface"></div>
	{/if}
</div>

<AcerolaConfirmDialog
	bind:state={confirmRemove}
	data={{
		title: m['sync.media.remove_title'](),
		description: m['sync.media.remove_description'](),
		cancelText: m['sync.common.cancel'](),
		actionText: m['sync.media.remove'](),
		icon: TrashIcon
	}}
	events={{ onAction: remove }}
/>
