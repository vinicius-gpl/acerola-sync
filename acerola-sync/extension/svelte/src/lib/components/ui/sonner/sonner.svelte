<script lang="ts">
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner';
	import { mode } from 'mode-watcher';
	import { fade } from 'svelte/transition';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { toastIconEnter } from '$lib/utils/toast-icon-motion.utils';

	let { toastOptions, class: className, ...restProps }: SonnerProps = $props();
</script>

<Sonner
	theme={mode.current}
	richColors
	class="toaster group {className ?? ''}"
	toastOptions={{
		classes: {
			// Mesmo desenho dos cartões do app: raio de cartão, sem borda, cor do estado no fundo
			// (`*-soft`) e no texto. As cores vêm das variáveis do sonner, abaixo.
			toast:
				'group toast rounded-card! border-0! px-4 py-3.5 text-sm font-semibold shadow-float! backdrop-blur-2xl',
			title: 'font-black text-sm tracking-tight',
			description: 'text-xs opacity-80 leading-relaxed mt-0.5',
			actionButton:
				'rounded-full! bg-primary! text-primary-foreground! font-bold text-xs px-3 py-1.5 transition-transform active:scale-95',
			cancelButton:
				'rounded-full! bg-muted! text-muted-foreground! font-medium text-xs px-3 py-1.5',
			closeButton:
				'rounded-full! border-0! bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors p-1',
			...toastOptions?.classes
		},
		...toastOptions
	}}
	style="--border-radius: var(--radius-card); --normal-bg: var(--color-card); --normal-text: var(--color-card-foreground); --normal-border: transparent; --success-bg: var(--color-success-soft); --success-text: var(--color-success); --success-border: transparent; --error-bg: var(--color-destructive-soft); --error-text: var(--color-destructive); --error-border: transparent; --warning-bg: var(--color-warning-soft); --warning-text: var(--color-warning); --warning-border: transparent; --info-bg: var(--color-info-soft); --info-text: var(--color-info); --info-border: transparent;"
	{...restProps}
>
	{#snippet loadingIcon()}
		<span use:toastIconEnter={'loading'} out:fade={{ duration: 120 }}>
			<Loader2Icon class="size-4 animate-spin" />
		</span>
	{/snippet}
	{#snippet successIcon()}
		<span use:toastIconEnter={'success'} out:fade={{ duration: 120 }}>
			<CircleCheckIcon class="size-4" />
		</span>
	{/snippet}
	{#snippet errorIcon()}
		<span use:toastIconEnter={'error'} out:fade={{ duration: 120 }}>
			<OctagonXIcon class="size-4" />
		</span>
	{/snippet}
	{#snippet infoIcon()}
		<span use:toastIconEnter={'info'} out:fade={{ duration: 120 }}>
			<InfoIcon class="size-4" />
		</span>
	{/snippet}
	{#snippet warningIcon()}
		<span use:toastIconEnter={'warning'} out:fade={{ duration: 120 }}>
			<TriangleAlertIcon class="size-4" />
		</span>
	{/snippet}
</Sonner>
