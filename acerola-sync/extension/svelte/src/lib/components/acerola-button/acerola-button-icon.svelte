<script module lang="ts">
	import { Button, type ButtonProps } from '$lib/components/ui/button';

	// "Outline" pattern: SOLID colored bg by default (not only on hover) with the icon in the
	// foreground color on top: the bg outlines the icon, not the other way around. `accent` is
	// for actions with no semantic meaning of their own (refresh, edit, navigate); the other
	// colors carry the action's meaning (danger, success, dismiss/cancel).
	export type AcerolaButtonIconTone = 'accent' | 'destructive' | 'success' | 'muted';

	// hover:brightness-110 is the same mechanism used on the AcerolaHeroButton/
	// AcerolaAccordionCard/AcerolaToggleCard icon: it works the same for any bg color, without
	// a /85 variant per tone. `!` (important) on the base bg/text is needed because
	// `tailwind-merge` does not know this project's custom color tokens
	// (accent-hero, chart-N, destructive-foreground): without it, a combined `ui.variant`
	// (e.g. `outline` has its own `bg-background`) could win in the final CSS depending on
	// Tailwind's generation order, leaving the icon invisible (dark bg + dark text).
	const TONE_CLASS: Record<AcerolaButtonIconTone, string> = {
		accent: 'bg-accent-hero! text-accent-hero-foreground! transition-[filter] hover:brightness-110',
		destructive:
			'bg-destructive! text-destructive-foreground! transition-[filter] hover:brightness-110',
		success: 'bg-chart-4! text-primary-foreground! transition-[filter] hover:brightness-110',
		muted: 'bg-muted! text-muted-foreground! transition-[filter] hover:brightness-110'
	};

	export type AcerolaButtonIconProps = {
		events?: {
			onClick?: ButtonProps['onclick'];
		};
		ui?: Omit<ButtonProps, 'children' | 'class' | 'onclick'> & {
			class?: string;
			tone?: AcerolaButtonIconTone;
		};
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';
	import type { Snippet } from 'svelte';

	let {
		children,
		events,
		ui
	}: AcerolaButtonIconProps & {
		children?: Snippet;
	} = $props();

	const uiProps = $derived.by(() => {
		const { class: _class, tone: _tone, ...rest } = ui ?? {};
		return rest;
	});
</script>

<Button
	class={cn(
		'size-10 rounded-inner p-0 enabled:cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed',
		ui?.tone && TONE_CLASS[ui.tone],
		ui?.class
	)}
	onclick={events?.onClick}
	{...uiProps}
>
	{@render children?.()}
</Button>
