<script lang="ts">
	import AcerolaBrandImage from '$lib/components/acerola-brand-image/acerola-brand-image.svelte';
	import AcerolaPillNav from '$lib/components/acerola-pill-nav/acerola-pill-nav.svelte';
	import AcerolaSonner from '$lib/components/acerola-sonner/acerola-sonner.svelte';
	import { initTheme } from '$lib/hooks/theme/use-theme.svelte';
	import { m } from '$lib/paraglide/messages';
	import { app, isTopRoute, type AppMode, type TopRoute } from '$lib/state/app.svelte';
	import { prefersReducedMotion, revealIn } from '$lib/utils/motion.utils';
	import { STORAGE_KEYS } from '$lib/constants/storage-keys';
	import type { NotificationItem } from '$lib/services/airing.service';
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import BellIcon from '@lucide/svelte/icons/bell';
	import ExpandIcon from '@lucide/svelte/icons/expand';
	import LibraryIcon from '@lucide/svelte/icons/library';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings-2';
	import gsap from 'gsap';
	import { onMount } from 'svelte';
	import { storage } from 'wxt/utils/storage';
	import ActivityScreen from './activity-screen.svelte';
	import HomeScreen from './home-screen.svelte';
	import LinkScreen from './link-screen.svelte';
	import LoginScreen from './login-screen.svelte';
	import MediaScreen from './media-screen.svelte';
	import NotificationsScreen from './notifications-screen.svelte';
	import SearchScreen from './search-screen.svelte';
	import SettingsScreen from './settings-screen.svelte';

	let { mode }: { mode: AppMode } = $props();

	type Screen = TopRoute | 'media' | 'link' | 'notifications';

	let scroller = $state<HTMLElement>();
	// Every new screen opens at the top. Without this, opening a media with the list scrolled
	// left the media scrolled too, and the action row (back, sync, AniList) was hidden.
	$effect(() => {
		void app.route;
		if (scroller) scroller.scrollTop = 0;
	});

	/** Notices not yet seen on the notifications screen (the dot on the bell). */
	let unread = $state(0);
	const countUnread = (items: NotificationItem[] | null) =>
		(unread = (items ?? []).filter((item) => !item.read).length);

	onMount(() => {
		void initTheme();
		void app.init(mode);
		void storage
			.getItem<NotificationItem[]>(STORAGE_KEYS.notifications)
			.then(countUnread)
			.catch(() => {});
		return storage.watch<NotificationItem[]>(STORAGE_KEYS.notifications, countUnread);
	});

	const navItems = $derived([
		{ id: 'list', label: m['sync.nav.list'](), icon: LibraryIcon },
		{ id: 'search', label: m['sync.nav.search'](), icon: SearchIcon },
		{ id: 'activity', label: m['sync.nav.activity'](), icon: ActivityIcon },
		{ id: 'settings', label: m['sync.nav.settings'](), icon: SettingsIcon }
	]);

	const page = $derived(mode === 'page');
	const loggedIn = $derived(!!app.session && !!app.api);
	// In page mode the media opens in a panel over the current tab; in the popup it becomes the screen.
	const screen = $derived<Screen>(
		page && app.route.name === 'media' ? app.underRoute : app.route.name
	);
	const panelMediaId = $derived(page && app.route.name === 'media' ? app.route.mediaId : null);
	const activeNav = $derived(isTopRoute(screen) ? screen : null);

	function select(id: string) {
		if (isTopRoute(id)) app.open(id);
	}

	/** Side panel slides in from the right. */
	function slideIn(node: HTMLElement) {
		if (prefersReducedMotion()) return;
		gsap.fromTo(
			node,
			{ x: 60, opacity: 0 },
			{ x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }
		);
	}
</script>

{#snippet bell()}
	<button
		type="button"
		class="relative flex cursor-pointer items-center justify-center rounded-full bg-surface text-muted-foreground transition-colors hover:text-foreground {page
			? 'size-10'
			: 'size-8'}"
		onclick={() => app.route.name !== 'notifications' && app.push({ name: 'notifications' })}
		aria-label={m['sync.notifications.open']()}
		title={m['sync.notifications.open']()}
		data-notifications-bell
	>
		<BellIcon size={page ? 16 : 14} />
		{#if unread > 0}
			<span
				class="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-success"
				data-unread-dot
			></span>
		{/if}
	</button>
{/snippet}

{#snippet content(name: Screen)}
	{#if name === 'list'}
		<HomeScreen />
	{:else if name === 'search'}
		<SearchScreen />
	{:else if name === 'activity'}
		<ActivityScreen />
	{:else if name === 'settings'}
		<SettingsScreen />
	{:else if name === 'media' && app.route.name === 'media'}
		{#key app.route.mediaId}
			<MediaScreen mediaId={app.route.mediaId} />
		{/key}
	{:else if name === 'link' && app.route.name === 'link'}
		<LinkScreen request={app.route.request} />
	{:else if name === 'notifications'}
		<NotificationsScreen />
	{/if}
{/snippet}

{#if page}
	<div class="min-h-screen bg-background text-foreground">
		<header
			class="sticky top-0 z-20 flex items-center justify-between gap-4 bg-background/80 px-8 py-4 backdrop-blur-xl"
		>
			<div class="flex items-center gap-2.5">
				<AcerolaBrandImage
					data={{ asset: 'logo', alt: 'Acerola' }}
					ui={{ class: 'size-9' }}
				/>
				<span class="text-lg font-black tracking-tight">Acerola Sync</span>
			</div>
			{#if loggedIn}
				<AcerolaPillNav
					data={{ items: navItems, active: activeNav }}
					events={{ onSelect: select }}
				/>
				<div class="flex items-center gap-2">
					{@render bell()}
					{#if app.session?.user.avatarUrl}
						<img
							src={app.session.user.avatarUrl}
							alt={app.session.user.name}
							class="size-10 rounded-full object-cover"
						/>
					{:else}
						<span class="size-10"></span>
					{/if}
				</div>
			{/if}
		</header>

		<main class="mx-auto w-full max-w-6xl px-8 pt-4 pb-16">
			{#if !app.ready}
				<div class="h-64 animate-pulse rounded-card bg-surface"></div>
			{:else if !loggedIn}
				<div class="mx-auto max-w-md"><LoginScreen /></div>
			{:else}
				{#key screen}
					<div use:revealIn>{@render content(screen)}</div>
				{/key}
			{/if}
		</main>

		{#if panelMediaId !== null}
			<button
				type="button"
				class="fixed inset-0 z-30 cursor-default bg-scrim/50 backdrop-blur-sm"
				aria-label={m['sync.common.back']()}
				onclick={() => app.back()}
			></button>
			<aside
				use:slideIn
				class="fixed inset-y-3 right-3 z-40 w-[460px] overflow-y-auto rounded-sheet bg-background p-5 shadow-float"
			>
				{@render content('media')}
			</aside>
		{/if}
	</div>
{:else}
	<div
		class="relative flex h-[600px] w-[440px] flex-col overflow-hidden bg-background text-foreground"
	>
		{#if loggedIn}
			<div class="flex flex-none items-center justify-between px-4 pt-3 pb-1">
				<AcerolaBrandImage
					data={{ asset: 'logo', alt: 'Acerola' }}
					ui={{ class: 'size-7' }}
				/>
				<div class="flex items-center gap-2">
					{@render bell()}
					<button
						type="button"
						class="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
						onclick={() => app.openFullPage()}
						title={m['sync.nav.openPage']()}
					>
						<ExpandIcon size={13} />
						{m['sync.nav.openPage']()}
					</button>
				</div>
			</div>
		{/if}

		<!-- Bottom space only when the pill bar shows (it floats over the content). -->
		<main
			bind:this={scroller}
			data-scroller
			class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 {loggedIn
				? 'fade-y-top'
				: ''} {loggedIn && activeNav ? 'pb-24' : 'pb-4'}"
		>
			{#if !app.ready}
				<div class="h-40 animate-pulse rounded-card bg-surface"></div>
			{:else if !loggedIn}
				<LoginScreen />
			{:else}
				{#key app.route}
					<div use:revealIn>{@render content(screen)}</div>
				{/key}
			{/if}
		</main>

		{#if loggedIn && activeNav}
			<div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
				<div class="pointer-events-auto">
					<AcerolaPillNav
						data={{ items: navItems, active: activeNav }}
						events={{ onSelect: select }}
					/>
				</div>
			</div>
		{/if}
	</div>
{/if}

<AcerolaSonner ui={{ position: page ? 'bottom-right' : 'top-center' }} />
