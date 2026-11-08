<script module lang="ts">
	export type AcerolaStatTileTone =
		'primary' | 'success' | 'warning' | 'info' | 'danger' | 'neutral';

	export type AcerolaStatTileProps = {
		data: {
			label: string;
			value: number | string;
			hint?: string | null;
		};
		ui?: {
			class?: string;
			tone?: AcerolaStatTileTone;
		};
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';
	import { countUp } from '$lib/utils/motion.utils';

	let { data, ui }: AcerolaStatTileProps = $props();

	// Bloco de cor sólida (tom "soft" da paleta do reader) com o número grande por cima.
	const TONE: Record<AcerolaStatTileTone, string> = {
		primary: 'bg-primary-soft text-primary',
		success: 'bg-success-soft text-success',
		warning: 'bg-warning-soft text-warning',
		info: 'bg-info-soft text-info',
		danger: 'bg-destructive-soft text-destructive',
		neutral: 'bg-surface text-foreground'
	};
</script>

<div
	class={cn(
		'flex flex-col justify-between gap-3 rounded-tile p-3.5',
		TONE[ui?.tone ?? 'neutral'],
		ui?.class
	)}
>
	<span class="text-[11px] font-bold tracking-wide uppercase opacity-80">{data.label}</span>
	<div class="flex items-baseline gap-1.5">
		{#if typeof data.value === 'number'}
			<span
				class="text-3xl leading-none font-black tracking-tight tabular-nums"
				use:countUp={data.value}>{data.value}</span
			>
		{:else}
			<span class="text-2xl leading-none font-black tracking-tight">{data.value}</span>
		{/if}
		{#if data.hint}
			<span class="truncate text-[11px] font-medium opacity-70">{data.hint}</span>
		{/if}
	</div>
</div>
