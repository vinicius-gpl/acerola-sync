<script lang="ts">
	import AcerolaEmptyState from '$lib/components/acerola-empty-state/acerola-empty-state.svelte';
	import { STORAGE_KEYS } from '$lib/constants/storage-keys';
	import { m } from '$lib/paraglide/messages';
	import type { NotificationItem } from '$lib/services/airing.service';
	import { app } from '$lib/state/app.svelte';
	import { staggerIn } from '$lib/utils/motion.utils';
	import { formatDateTime } from '$lib/utils/time.utils';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import BellIcon from '@lucide/svelte/icons/bell';
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { storage } from 'wxt/utils/storage';

	// Últimos avisos de episódio novo que o background mandou pelo sistema. Abrir a tela marca
	// tudo como lido; o "Novo" continua na tela até sair dela.
	let items = $state<NotificationItem[]>([]);
	let loaded = $state(false);
	const page = $derived(app.mode === 'page');

	async function load() {
		try {
			items = (await storage.getItem<NotificationItem[]>(STORAGE_KEYS.notifications)) ?? [];
			if (items.some((item) => !item.read)) {
				await storage.setItem(
					STORAGE_KEYS.notifications,
					items.map((item) => ({ ...item, read: true }))
				);
			}
		} catch (error) {
			console.warn('[Notifications] Could not load', error);
		} finally {
			loaded = true;
		}
	}

	async function clear() {
		await storage.setItem(STORAGE_KEYS.notifications, []);
		items = [];
		toast.success(m['sync.notifications.cleared']());
	}

	onMount(() => void load());
</script>

<div class="flex flex-col gap-5 pb-4">
	<div class="flex items-center">
		<button
			type="button"
			class="flex size-10 cursor-pointer items-center justify-center rounded-full bg-surface transition-transform hover:scale-105"
			onclick={() => app.back()}
			aria-label={m['sync.common.back']()}
		>
			{#if page}<XIcon size={18} />{:else}<ArrowLeftIcon size={18} />{/if}
		</button>
		<div class="flex-1"></div>
		{#if items.length}
			<button
				type="button"
				class="h-10 cursor-pointer rounded-full bg-surface px-4 text-xs font-bold transition-transform hover:scale-105"
				onclick={clear}
			>
				{m['sync.notifications.clear']()}
			</button>
		{/if}
	</div>

	<header>
		<p class="text-xs font-semibold text-muted-foreground">
			{m['sync.notifications.eyebrow']()}
		</p>
		<h1 class="leading-none font-black tracking-tighter {page ? 'text-6xl' : 'text-[44px]'}">
			{m['sync.notifications.title']()}
		</h1>
	</header>

	{#if !loaded}
		<div class="h-24 animate-pulse rounded-tile bg-surface"></div>
	{:else if items.length === 0}
		<AcerolaEmptyState
			data={{
				title: m['sync.notifications.empty'](),
				hint: m['sync.notifications.empty_hint'](),
				icon: BellIcon
			}}
		/>
	{:else}
		<ol class="flex flex-col gap-1" use:staggerIn>
			{#each items as item (item.id)}
				<li>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center gap-3 rounded-tile p-2 text-left transition-colors hover:bg-surface {item.read
							? ''
							: 'bg-success-soft'}"
						onclick={() => app.push({ name: 'media', mediaId: item.mediaId })}
						data-notification={item.id}
					>
						<img
							src={item.cover ?? ''}
							alt=""
							class="h-20 w-14 flex-none rounded-inner bg-surface object-cover shadow-lift"
						/>
						<div class="min-w-0 flex-1">
							<p class="line-clamp-2 text-sm leading-tight font-bold">{item.title}</p>
							<p class="text-xs text-muted-foreground">
								{m['sync.airing.episode']({ episode: item.episode })} · {formatDateTime(item.at)}
							</p>
						</div>
						{#if !item.read}
							<span
								class="flex flex-none items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-[11px] font-black text-background"
							>
								{m['sync.notifications.new']()}
							</span>
						{/if}
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</div>
