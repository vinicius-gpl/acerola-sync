<script lang="ts">
	import type { SearchHit } from '$lib/api/types';
	import type { LinkRequest } from '$lib/messaging';
	import { m } from '$lib/paraglide/messages';
	import { app } from '$lib/state/app.svelte';
	import { mediaTypeLabel } from '$lib/utils/labels.utils';
	import { revealIn } from '$lib/utils/motion.utils';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { toast } from 'svelte-sonner';
	import SearchScreen from './SearchScreen.svelte';

	let { request }: { request: LinkRequest } = $props();

	let linked = $state<SearchHit | null>(null);

	// Vincula a página do site à obra escolhida. Vale para todos os episódios/capítulos dela.
	async function pick(hit: SearchHit) {
		if (!app.api) return;
		try {
			await app.api.saveMapping({
				site: request.site,
				identifier: request.identifier,
				mediaId: hit.media.id,
				title: request.title
			});
			linked = hit;
			toast.success(m['sync.link.done']({ title: hit.media.titleUserPreferred }));
		} catch (error) {
			await app.handleError(error);
		}
	}
</script>

<div class="flex flex-col gap-5">
	<header>
		<p class="text-xs font-semibold text-muted-foreground">
			{request.site} · {mediaTypeLabel(request.mediaType)}
		</p>
		<h1 class="text-[44px] leading-none font-black tracking-tighter">{m['sync.link.title']()}</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			{m['sync.link.subtitle']({ title: request.title })}
		</p>
	</header>

	{#if linked}
		<section
			use:revealIn
			class="flex flex-col items-center gap-3 rounded-card bg-success-soft p-6 text-center text-success"
		>
			<span
				class="flex size-14 items-center justify-center rounded-full bg-success text-background"
			>
				<CheckIcon size={26} strokeWidth={3} />
			</span>
			<p
				class="line-clamp-2 text-xl font-black tracking-tight"
				title={linked.media.titleUserPreferred}
			>
				{linked.media.titleUserPreferred}
			</p>
			<p class="text-xs font-semibold">{m['sync.link.reload_hint']()}</p>
			<button
				type="button"
				class="mt-2 h-11 cursor-pointer rounded-full bg-foreground px-6 text-sm font-black text-background"
				onclick={() => window.close()}
			>
				{m['sync.link.close']()}
			</button>
		</section>
	{:else}
		<SearchScreen
			mediaType={request.mediaType}
			initialQuery={request.title}
			onPick={pick}
			hideHeader
		/>
	{/if}
</div>
