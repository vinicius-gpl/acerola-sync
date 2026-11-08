<script module lang="ts">
	import type { SyncLog } from '$lib/api/types';

	export type AcerolaLogConsoleProps = {
		data: {
			logs: SyncLog[];
			running?: boolean;
			empty?: string;
		};
		ui?: {
			class?: string;
		};
	};
</script>

<script lang="ts">
	import gsap from 'gsap';
	import { tick } from 'svelte';
	import { cn } from '$lib/utils/cn.utils';
	import { prefersReducedMotion } from '$lib/utils/motion.utils';
	import { DISPLAY_TIME_ZONE } from '$lib/utils/time.utils';

	let { data, ui }: AcerolaLogConsoleProps = $props();

	let scroller = $state<HTMLElement>();
	let shown = 0;

	const LEVEL_DOT = {
		INFO: 'bg-info',
		WARN: 'bg-warning',
		ERROR: 'bg-destructive'
	} as const;

	const timeFormat = new Intl.DateTimeFormat('pt-BR', {
		timeZone: DISPLAY_TIME_ZONE,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	// Linha nova entra deslizando e a lista desce junto, como um terminal.
	$effect(() => {
		const count = data.logs.length;
		if (count === shown) return;
		const from = shown;
		shown = count;
		void tick().then(() => {
			if (!scroller) return;
			scroller.scrollTop = scroller.scrollHeight;
			const fresh = [...scroller.querySelectorAll('[data-log-line]')].slice(from);
			if (fresh.length && !prefersReducedMotion()) {
				gsap.fromTo(
					fresh,
					{ x: -8, opacity: 0 },
					{ x: 0, opacity: 1, duration: 0.3, stagger: 0.04 }
				);
			}
		});
	});
</script>

<div
	bind:this={scroller}
	class={cn(
		'max-h-64 overflow-y-auto rounded-tile bg-crust p-3 font-mono text-[11px] leading-relaxed text-foreground/90',
		ui?.class
	)}
	role="log"
	aria-live="polite"
>
	{#if data.logs.length === 0 && !data.running}
		<p class="text-muted-foreground">{data.empty ?? '—'}</p>
	{/if}
	{#each data.logs as log (log.id)}
		<div class="flex items-start gap-2" data-log-line>
			<span class="flex-none text-muted-foreground"
				>{timeFormat.format(new Date(log.createdAt))}</span
			>
			<span class={cn('mt-1.5 size-1.5 flex-none rounded-full', LEVEL_DOT[log.level])}></span>
			<span class="min-w-0 break-words">{log.message}</span>
		</div>
	{/each}
	{#if data.running}
		<div class="mt-1 flex items-center gap-2 text-primary" data-log-running>
			<span class="inline-block h-3 w-1.5 animate-pulse bg-primary"></span>
		</div>
	{/if}
</div>
