<script module lang="ts">
	import type { Snippet } from 'svelte';

	export type AcerolaCardImageSize = 'sm' | 'md' | 'lg';

	export type AcerolaCardImageProps = {
		data: {
			title: string;
			cover?: string | null;
			progress?: number;
			description?: string;
		};
		events?: {
			onClick?: (event: MouseEvent) => void;
		};
		ui?: {
			class?: string;
			size?: AcerolaCardImageSize;
			hideTitle?: boolean;
		};
	};

	export type AcerolaCardImageSnippets = {
		placeholder?: Snippet;
		overlay?: Snippet;
		footer?: Snippet;
		action?: Snippet;
		floatingBadge?: Snippet;
	};
</script>

<script lang="ts">
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import { AspectRatio } from '$lib/components/ui/aspect-ratio';
	import { cn } from '$lib/utils/cn.utils';

	let {
		ui,
		data,
		events,
		footer,
		action,
		overlay,
		placeholder,
		floatingBadge
	}: AcerolaCardImageProps & AcerolaCardImageSnippets = $props();

	const sizeClasses: Record<AcerolaCardImageSize, string> = {
		sm: 'w-24',
		md: 'w-36',
		lg: 'w-48'
	};

	const size = $derived(ui?.size ?? 'md');
	const hideTitle = $derived(ui?.hideTitle ?? false);
</script>

<div
	class={cn(
		'group relative transition-transform duration-300 hover:-translate-y-2 hover:scale-[1.02]',
		sizeClasses[size],
		ui?.class
	)}
>
	{#if floatingBadge}
		{@render floatingBadge()}
	{/if}

	<AspectRatio
		ratio={2 / 3}
		class="relative rounded-xl bg-surface shadow-lg transition-shadow duration-300 group-hover:shadow-2xl group-hover:shadow-primary/20"
	>
		<div class="h-full w-full overflow-hidden rounded-xl">
			<button
				type="button"
				class="relative h-full w-full cursor-pointer text-left"
				onclick={events?.onClick}
			>
				{#if data.cover}
					<img
						src={data.cover}
						alt={data.title}
						class="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
					/>
				{:else if placeholder}
					{@render placeholder()}
				{:else}
					<div
						class="flex h-full w-full items-center justify-center bg-surface text-muted-foreground"
					>
						<BookOpenIcon size={40} />
					</div>
				{/if}
				{#if overlay}
					{@render overlay()}
				{/if}

				{#if data.description}
					<div
						class="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-crust via-crust/30 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
					>
						<p
							class="line-clamp-3 translate-y-2 text-xs text-foreground transition-transform duration-300 group-hover:translate-y-0"
						>
							{data.description}
						</p>
					</div>
				{/if}

				{#if data.progress !== undefined}
					<div class="absolute bottom-0 left-0 h-1 w-full bg-surface">
						<div
							class="h-full bg-primary transition-all duration-500"
							style={`width:${Math.min(100, Math.max(0, data.progress))}%`}
						></div>
					</div>
				{/if}
			</button>
		</div>
	</AspectRatio>

	{#if !hideTitle}
		<div class="mt-3 flex items-start justify-between gap-2 px-1">
			<div class="min-w-0 flex-1">
				<h3
					class="line-clamp-1 text-sm font-bold transition-colors duration-200 group-hover:text-primary"
				>
					{data.title}
				</h3>

				{#if footer}
					<div class="mt-1">
						{@render footer()}
					</div>
				{/if}
			</div>

			{#if action}
				{@render action()}
			{/if}
		</div>
	{/if}
</div>
