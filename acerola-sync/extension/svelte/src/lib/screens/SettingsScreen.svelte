<script lang="ts">
	import type { CustomSite, CustomSiteInput, MediaType, ProgressSource } from '$lib/api/types';
	import AcerolaChipTabs from '$lib/components/acerola-chip-tabs/acerola-chip-tabs.svelte';
	import AcerolaSheetDialog from '$lib/components/acerola-sheet-dialog/acerola-sheet-dialog.svelte';
	import AcerolaSection from '$lib/components/acerola-section/acerola-section.svelte';
	import AcerolaSiteIcon from '$lib/components/acerola-site-icon/acerola-site-icon.svelte';
	import AcerolaSwitch from '$lib/components/acerola-switch/acerola-switch.svelte';
	import { STORAGE_KEYS } from '$lib/constants/storage-keys';
	import { useTheme, type ThemeModeOption } from '$lib/hooks/theme/use-theme.svelte';
	import { sendMessage } from '$lib/messaging';
	import { m } from '$lib/paraglide/messages';
	import { app } from '$lib/state/app.svelte';
	import { originPattern } from '$lib/tracking/match-pattern';
	import { BUILT_IN_SITES } from '$lib/tracking/registry';
	import { testSiteOnTab, type SiteTestResult } from '$lib/services/site-test.service';
	import type { ProgressSuggestion } from '$lib/tracking/progress-source';
	import { createCustomAdapter, readsProgressFromPage } from '$lib/tracking/sites/custom';
	import { cn } from '$lib/utils/cn.utils';
	import { mediaTypeLabel } from '$lib/utils/labels.utils';
	import { staggerIn } from '$lib/utils/motion.utils';
	import ExpandIcon from '@lucide/svelte/icons/expand';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { browser } from 'wxt/browser';
	import { storage } from 'wxt/utils/storage';

	const theme = useTheme();
	const page = $derived(app.mode === 'page');

	let disabledSites = $state<string[]>([]);
	let mangaDelay = $state(10);
	let customSites = $state<CustomSite[]>([]);
	let dialog = $state({ open: false });

	const emptyDraft = (): CustomSiteInput => ({
		name: '',
		mediaType: 'MANGA',
		matchPattern: '',
		urlPattern: '',
		titleSelector: '',
		enabled: true,
		searchUrl: '',
		progressSource: 'url',
		progressSelector: '',
		progressPattern: ''
	});
	let draft = $state<CustomSiteInput>(emptyDraft());
	/** Site sendo editado; `null` = cadastro novo. */
	let editing = $state<CustomSite | null>(null);
	let sampleUrl = $state('');
	/** Modo avançado: o dialog cresce (só na página cheia) e mostra a fonte do número. */
	let advanced = $state(false);
	let testing = $state(false);
	let testResult = $state<SiteTestResult | null>(null);
	const fromPage = $derived(readsProgressFromPage(draft));

	/** Prévia do que a regex tira da URL de exemplo, antes de salvar. */
	const preview = $derived.by(() => {
		if (!sampleUrl.trim() || !draft.urlPattern.trim()) return null;
		try {
			const url = new URL(sampleUrl);
			const key = createCustomAdapter({ ...draft, id: 'preview' }).pageKey(url);
			if (!key) return { ok: false, text: m['sync.settings.custom.preview_none']() };
			if (fromPage) {
				const id = new RegExp(draft.urlPattern).exec(url.href)?.groups?.id ?? '';
				return { ok: true, text: m['sync.settings.custom.preview_page']({ id }) };
			}
			const [id, progress] = key.split('/');
			return { ok: true, text: m['sync.settings.custom.preview']({ id, progress }) };
		} catch {
			return { ok: false, text: m['sync.settings.custom.preview_none']() };
		}
	});
	const canSave = $derived(
		!!draft.name.trim() &&
			!!draft.matchPattern.trim() &&
			!!draft.urlPattern.trim() &&
			(draft.progressSource !== 'selector' || !!draft.progressSelector?.trim())
	);

	/** Sites ligados sem a permissão do domínio: o script não roda lá até liberar. */
	let missingPermission = $state<string[]>([]);

	async function checkPermissions() {
		const missing: string[] = [];
		for (const site of customSites) {
			const origin = originPattern(site.matchPattern);
			if (!site.enabled || !origin) continue;
			try {
				if (!(await browser.permissions.contains({ origins: [origin] }))) missing.push(site.id);
			} catch {
				// Navegador sem a API: não dá para saber, não avisa.
			}
		}
		missingPermission = missing;
	}

	async function grantSite(site: CustomSite) {
		const granted = requestOrigin(site.matchPattern);
		if (!(await granted)) {
			toast.error(m['sync.settings.custom.permission_denied']());
			return;
		}
		await refreshScripts();
		toast.success(m['sync.settings.custom.granted']());
	}

	async function loadCustomSites() {
		try {
			customSites = (await app.api?.customSites()) ?? [];
			void checkPermissions();
			await storage.setItem(STORAGE_KEYS.customSites, $state.snapshot(customSites));
		} catch (error) {
			await app.handleError(error);
		}
	}

	onMount(async () => {
		disabledSites = (await storage.getItem<string[]>(STORAGE_KEYS.disabledSites)) ?? [];
		mangaDelay = (await storage.getItem<number>(STORAGE_KEYS.mangaDelaySeconds)) ?? 10;
		await loadCustomSites();
		if (page && new URLSearchParams(location.search).has('site')) await resumeFromPopup();
	});

	type PendingSiteDraft = { draft: CustomSiteInput; editingId: string | null };

	/** Popup pediu o modo avançado: reabre aqui o mesmo rascunho, já com o dialog grande. */
	async function resumeFromPopup() {
		const pending = await storage.getItem<PendingSiteDraft>(STORAGE_KEYS.pendingSiteDraft);
		await storage.removeItem(STORAGE_KEYS.pendingSiteDraft);
		const site = customSites.find((site) => site.id === pending?.editingId) ?? null;
		if (site) openEdit(site);
		else openNew();
		if (pending) draft = { ...emptyDraft(), ...pending.draft };
		advanced = true;
	}

	/** No popup não cabe: leva o rascunho para a página cheia, que abre no modo avançado. */
	async function openAdvanced() {
		if (page) {
			advanced = !advanced;
			return;
		}
		const pending: PendingSiteDraft = {
			draft: $state.snapshot(draft),
			editingId: editing?.id ?? null
		};
		await storage.setItem(STORAGE_KEYS.pendingSiteDraft, pending);
		await app.openFullPage(`?site=${editing?.id ?? 'new'}`);
	}

	async function testOnTab() {
		// Pedido no clique, antes de qualquer await: sem a permissão não dá para ler a aba.
		const granted = requestOrigin(draft.matchPattern);
		testing = true;
		testResult = null;
		try {
			if (!(await granted)) {
				toast.error(m['sync.settings.custom.permission_denied']());
				return;
			}
			testResult = await testSiteOnTab($state.snapshot(draft));
		} finally {
			testing = false;
		}
	}

	function useSuggestion(suggestion: ProgressSuggestion) {
		draft.progressSource = suggestion.source;
		draft.progressSelector = suggestion.selector ?? '';
		draft.progressPattern = suggestion.pattern;
		void testOnTab();
	}

	async function toggleSite(id: string, enabled: boolean) {
		disabledSites = enabled ? disabledSites.filter((site) => site !== id) : [...disabledSites, id];
		await storage.setItem(STORAGE_KEYS.disabledSites, $state.snapshot(disabledSites));
	}

	async function stepDelay(delta: number) {
		mangaDelay = Math.min(120, Math.max(0, mangaDelay + delta));
		await storage.setItem(STORAGE_KEYS.mangaDelaySeconds, mangaDelay);
	}

	/** Pede a permissão do domínio: precisa acontecer no clique, antes de qualquer `await`. */
	function requestOrigin(matchPattern: string) {
		const origin = originPattern(matchPattern);
		return origin ? browser.permissions.request({ origins: [origin] }) : Promise.resolve(false);
	}

	async function refreshScripts() {
		await loadCustomSites();
		await sendMessage({ type: 'custom-sites:refresh' });
	}

	function openNew() {
		editing = null;
		draft = emptyDraft();
		sampleUrl = '';
		advanced = false;
		testResult = null;
		dialog = { open: true };
	}

	function openEdit(site: CustomSite) {
		editing = site;
		const { id: _id, ...input } = site;
		draft = {
			...input,
			titleSelector: site.titleSelector ?? '',
			searchUrl: site.searchUrl ?? '',
			progressSource: site.progressSource ?? 'url',
			progressSelector: site.progressSelector ?? '',
			progressPattern: site.progressPattern ?? ''
		};
		sampleUrl = '';
		testResult = null;
		// Site com o número na página só se edita no modo avançado (no popup, na página cheia).
		advanced = readsProgressFromPage(site);
		if (advanced && !page) {
			void openAdvanced();
			return;
		}
		dialog = { open: true };
	}

	async function saveSite() {
		if (!app.api) return;
		const current = editing;
		// Ligado = precisa da permissão do domínio. Se já foi dada, o navegador responde na hora
		// sem perguntar; se não (site cadastrado fora da tela), é aqui que ela é pedida.
		const granted = draft.enabled ? requestOrigin(draft.matchPattern) : Promise.resolve(true);
		try {
			if (!(await granted)) {
				toast.error(m['sync.settings.custom.permission_denied']());
				return;
			}
			const input = {
				...$state.snapshot(draft),
				titleSelector: draft.titleSelector?.trim() || null,
				searchUrl: draft.searchUrl?.trim() || null,
				progressSelector: draft.progressSelector?.trim() || null,
				progressPattern: draft.progressPattern?.trim() || null
			};
			if (current) await app.api.updateCustomSite(current.id, input);
			else await app.api.createCustomSite(input);
			editing = null;
			draft = emptyDraft();
			sampleUrl = '';
			dialog = { open: false };
			await refreshScripts();
			toast.success(
				current ? m['sync.settings.custom.updated']() : m['sync.settings.custom.saved']()
			);
		} catch (error) {
			await app.handleError(error);
		}
	}

	async function toggleCustomSite(site: CustomSite, enabled: boolean) {
		if (!app.api) return;
		const granted = enabled ? requestOrigin(site.matchPattern) : Promise.resolve(true);
		try {
			if (!(await granted)) return;
			const { id, ...input } = site;
			await app.api.updateCustomSite(id, { ...input, enabled });
			await refreshScripts();
		} catch (error) {
			await app.handleError(error);
		}
	}

	async function deleteCustomSite(site: CustomSite) {
		if (!app.api) return;
		try {
			await app.api.deleteCustomSite(site.id);
			await refreshScripts();
		} catch (error) {
			await app.handleError(error);
		}
	}

	const field =
		'h-11 w-full rounded-inner bg-surface px-4 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring';
</script>

<div class="flex flex-col gap-6 pb-4">
	<header>
		<p class="text-xs font-semibold text-muted-foreground">{m['sync.settings.eyebrow']()}</p>
		<h1 class="leading-none font-black tracking-tighter {page ? 'text-6xl' : 'text-[44px]'}">
			{m['sync.settings.title']()}
		</h1>
	</header>

	<!-- Perfil: cartão de cor sólida com avatar grande. -->
	<section class="flex items-center gap-4 rounded-card bg-primary p-4 text-primary-foreground">
		{#if app.session?.user.avatarUrl}
			<img src={app.session.user.avatarUrl} alt="" class="size-16 rounded-full object-cover" />
		{:else}
			<span
				class="flex size-16 items-center justify-center rounded-full bg-background/20 text-2xl font-black"
			>
				{app.session?.user.name.slice(0, 1).toUpperCase()}
			</span>
		{/if}
		<div class="min-w-0 flex-1">
			<p class="truncate text-xl leading-tight font-black tracking-tight">
				{app.session?.user.name}
			</p>
			<p class="truncate text-xs font-semibold opacity-75">{app.serverUrl}</p>
		</div>
		<button
			type="button"
			class="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full bg-background/20 transition-transform hover:scale-105"
			onclick={() => app.logout()}
			aria-label={m['sync.settings.logout']()}
			title={m['sync.settings.logout']()}
		>
			<LogOutIcon size={18} />
		</button>
	</section>

	<AcerolaSection data={{ title: m['sync.settings.appearance']() }}>
		<AcerolaChipTabs
			data={{
				items: [
					{ id: 'light', label: m['sync.settings.light']() },
					{ id: 'dark', label: m['sync.settings.dark']() },
					{ id: 'system', label: m['sync.settings.system']() }
				],
				active: theme.mode
			}}
			events={{ onSelect: (id) => theme.setMode(id as ThemeModeOption) }}
		/>
	</AcerolaSection>

	<AcerolaSection
		data={{ title: m['sync.settings.sites'](), hint: m['sync.settings.sites_hint']() }}
	>
		<ul class="flex flex-col gap-1.5" use:staggerIn>
			{#each BUILT_IN_SITES as site (site.id)}
				<li class="flex items-center gap-3 rounded-tile bg-card p-2.5 pr-4">
					<AcerolaSiteIcon data={{ name: site.name, url: site.homepage }} />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-bold">{site.name}</p>
						<p class="text-xs text-muted-foreground">
							{mediaTypeLabel(site.mediaType)} ·
							{site.trigger === 'video'
								? m['sync.settings.trigger_video']()
								: m['sync.settings.trigger_delay']()}
						</p>
					</div>
					<AcerolaSwitch
						state={{ checked: !disabledSites.includes(site.id) }}
						events={{ onCheckedChange: (checked) => toggleSite(site.id, checked) }}
					/>
				</li>
			{/each}
		</ul>

		<div class="flex items-center justify-between gap-3 rounded-tile bg-card p-2.5 pl-4">
			<div class="min-w-0">
				<p class="text-sm font-bold">{m['sync.settings.manga_delay']()}</p>
				<p class="text-xs text-muted-foreground">{m['sync.settings.manga_delay_hint']()}</p>
			</div>
			<div class="flex items-center gap-1 rounded-full bg-surface p-1">
				<button
					type="button"
					class="flex size-8 cursor-pointer items-center justify-center rounded-full bg-background"
					onclick={() => stepDelay(-5)}
					aria-label="-5"
				>
					<MinusIcon size={14} />
				</button>
				<span class="w-12 text-center text-sm font-black tabular-nums">{mangaDelay}s</span>
				<button
					type="button"
					class="flex size-8 cursor-pointer items-center justify-center rounded-full bg-background"
					onclick={() => stepDelay(5)}
					aria-label="+5"
				>
					<PlusIcon size={14} />
				</button>
			</div>
		</div>
	</AcerolaSection>

	<AcerolaSection
		data={{ title: m['sync.settings.custom.title'](), hint: m['sync.settings.custom.hint']() }}
	>
		{#snippet actions()}
			<button
				type="button"
				class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-black text-background"
				onclick={openNew}
			>
				<PlusIcon size={14} />
				{m['sync.settings.custom.add']()}
			</button>
		{/snippet}

		{#if customSites.length}
			<ul class="flex flex-col gap-1.5">
				{#each customSites as site (site.id)}
					<li class="flex items-center gap-3 rounded-tile bg-card p-2.5 pr-3">
						<AcerolaSiteIcon data={{ name: site.name, url: site.matchPattern }} />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-bold">{site.name}</p>
							<p class="truncate font-mono text-[11px] text-muted-foreground">
								{site.matchPattern}
							</p>
							{#if missingPermission.includes(site.id)}
								<button
									type="button"
									class="mt-1 flex h-6 cursor-pointer items-center gap-1 rounded-full bg-warning-soft px-2.5 text-[11px] font-bold text-warning"
									onclick={() => grantSite(site)}
									data-grant-site={site.id}
								>
									{m['sync.settings.custom.grant']()}
								</button>
							{/if}
						</div>
						<AcerolaSwitch
							state={{ checked: site.enabled }}
							events={{ onCheckedChange: (checked) => toggleCustomSite(site, checked) }}
						/>
						<button
							type="button"
							class="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
							aria-label={`${m['sync.settings.custom.edit']()} ${site.name}`}
							onclick={() => openEdit(site)}
							data-edit-site={site.id}
						>
							<PencilIcon size={15} />
						</button>
						<button
							type="button"
							class="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
							aria-label={m['sync.common.remove']()}
							onclick={() => deleteCustomSite(site)}
						>
							<Trash2Icon size={15} />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="rounded-tile bg-card p-4 text-xs text-muted-foreground">
				{m['sync.settings.custom.empty']()}
			</p>
		{/if}
	</AcerolaSection>

	{#if !page}
		<button
			type="button"
			class="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface text-sm font-bold"
			onclick={() => app.openFullPage()}
		>
			<ExpandIcon size={16} />
			{m['sync.settings.open_page']()}
		</button>
	{/if}
</div>

<AcerolaSheetDialog
	bind:state={dialog}
	data={{
		title: editing
			? m['sync.settings.custom.edit_title']()
			: m['sync.settings.custom.dialog_title'](),
		description: fromPage
			? m['sync.settings.custom.help_page']()
			: m['sync.settings.custom.help'](),
		closeLabel: m['sync.tracking.close']()
	}}
	ui={{ class: advanced && page ? 'max-w-4xl' : undefined }}
>
	<div class="grid gap-x-6 gap-y-2.5 {advanced && page ? 'md:grid-cols-2' : ''}">
		<div class="flex flex-col gap-2.5">
			<div class="flex gap-2">
				<input
					class="{field} flex-1"
					placeholder={m['sync.settings.custom.name']()}
					bind:value={draft.name}
				/>
				<AcerolaChipTabs
					data={{
						items: [
							{ id: 'MANGA', label: mediaTypeLabel('MANGA') },
							{ id: 'ANIME', label: mediaTypeLabel('ANIME') }
						],
						active: draft.mediaType
					}}
					events={{ onSelect: (id) => (draft.mediaType = id as MediaType) }}
					ui={{ size: 'sm', class: 'flex-none self-center' }}
				/>
			</div>
			<input
				class="{field} font-mono text-xs"
				placeholder="https://leitor.exemplo.com/*"
				bind:value={draft.matchPattern}
			/>
			<input
				class="{field} font-mono text-xs"
				placeholder={fromPage
					? '/read/(?<id>\\d+)/\\d+'
					: '/obra/(?<id>[^/]+)/cap-(?<progress>\\d+)'}
				bind:value={draft.urlPattern}
			/>
			<input
				class="{field} font-mono text-xs"
				placeholder={m['sync.settings.custom.title_selector']()}
				bind:value={draft.titleSelector}
			/>
			<input
				class="{field} font-mono text-xs"
				placeholder={`${m['sync.settings.custom.search_url']()} · https://site.com/busca?q={title}`}
				aria-label={m['sync.settings.custom.search_url']()}
				bind:value={draft.searchUrl}
			/>
			<input
				class="{field} font-mono text-xs"
				placeholder={m['sync.settings.custom.sample_url']()}
				bind:value={sampleUrl}
			/>
			{#if preview}
				<p
					class="rounded-inner px-4 py-2.5 text-xs font-bold {preview.ok
						? 'bg-success-soft text-success'
						: 'bg-warning-soft text-warning'}"
				>
					{preview.text}
				</p>
			{/if}
		</div>

		{#if advanced && page}
			<!-- Modo avançado: de onde sai o número e o teste numa aba aberta do site. -->
			<section class="flex flex-col gap-2.5 rounded-tile bg-surface p-4" data-advanced>
				<h3 class="text-sm font-black">{m['sync.settings.custom.progress_title']()}</h3>
				<AcerolaChipTabs
					data={{
						items: [
							{ id: 'url', label: m['sync.settings.custom.source_url']() },
							{ id: 'title', label: m['sync.settings.custom.source_title']() },
							{ id: 'selector', label: m['sync.settings.custom.source_selector']() }
						],
						active: draft.progressSource ?? 'url'
					}}
					events={{
						onSelect: (id) => {
							draft.progressSource = id as ProgressSource;
							testResult = null;
						}
					}}
					ui={{ size: 'sm', class: 'self-start bg-background' }}
				/>
				{#if draft.progressSource === 'selector'}
					<input
						class={cn(field, 'bg-background font-mono text-xs')}
						placeholder={m['sync.settings.custom.progress_selector']()}
						bind:value={draft.progressSelector}
					/>
				{/if}
				{#if fromPage}
					<input
						class={cn(field, 'bg-background font-mono text-xs')}
						placeholder={m['sync.settings.custom.progress_pattern']()}
						aria-label={m['sync.settings.custom.progress_pattern']()}
						bind:value={draft.progressPattern}
					/>
					<p class="px-1 text-xs text-muted-foreground">
						{m['sync.settings.custom.progress_pattern_hint']()}
					</p>
				{/if}

				<button
					type="button"
					class="mt-auto flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-background text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
					disabled={testing || !draft.matchPattern.trim() || !draft.urlPattern.trim()}
					onclick={testOnTab}
					data-test-tab
				>
					<FlaskConicalIcon size={14} />
					{m['sync.settings.custom.test_tab']()}
				</button>

				{#if testResult}
					{#if testResult.status === 'no-tab'}
						<p class="rounded-inner bg-warning-soft px-4 py-2.5 text-xs font-bold text-warning">
							{m['sync.settings.custom.test_no_tab']()}
						</p>
					{:else if testResult.status === 'error'}
						<p
							class="rounded-inner bg-destructive-soft px-4 py-2.5 text-xs font-bold text-destructive"
						>
							{m['sync.settings.custom.test_failed']({ message: testResult.message })}
						</p>
					{:else}
						<div
							class="flex flex-col gap-1 rounded-inner px-4 py-2.5 text-xs font-bold {testResult.id &&
							testResult.progress
								? 'bg-success-soft text-success'
								: 'bg-warning-soft text-warning'}"
							data-test-result
						>
							<span class="truncate font-mono text-[11px] font-medium opacity-80">
								{testResult.url}
							</span>
							{#if !testResult.id}
								<span>{m['sync.settings.custom.test_no_id']()}</span>
							{:else if !testResult.progress}
								<span>{m['sync.settings.custom.test_no_progress']()}</span>
							{:else}
								<span>
									{m['sync.settings.custom.test_result']({
										id: testResult.id,
										progress: testResult.progress
									})}
								</span>
							{/if}
						</div>
						{#if testResult.suggestion}
							{@const suggestion = testResult.suggestion}
							<div
								class="flex items-center gap-3 rounded-inner bg-info-soft px-4 py-2.5 text-xs font-bold text-info"
								data-suggestion
							>
								<span class="min-w-0 flex-1">
									{m['sync.settings.custom.suggestion']({
										text: suggestion.text,
										progress: suggestion.progress
									})}
								</span>
								<button
									type="button"
									class="h-8 flex-none cursor-pointer rounded-full bg-foreground px-4 text-xs font-black text-background"
									onclick={() => useSuggestion(suggestion)}
								>
									{m['sync.settings.custom.suggestion_use']()}
								</button>
							</div>
						{/if}
					{/if}
				{/if}
			</section>
		{/if}

		<div class="flex flex-col gap-2 {advanced && page ? 'md:col-span-2' : ''}">
			<button
				type="button"
				class="mt-1 h-11 cursor-pointer rounded-full bg-primary text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!canSave}
				onclick={saveSite}
			>
				{m['sync.settings.custom.save']()}
			</button>
			<button
				type="button"
				class="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-bold text-muted-foreground hover:bg-surface hover:text-foreground"
				onclick={openAdvanced}
				title={m['sync.settings.custom.advanced_hint']()}
				data-advanced-toggle
			>
				<SlidersHorizontalIcon size={14} />
				{advanced && page
					? m['sync.settings.custom.basic']()
					: m['sync.settings.custom.advanced']()}
			</button>
		</div>
	</div>
</AcerolaSheetDialog>
