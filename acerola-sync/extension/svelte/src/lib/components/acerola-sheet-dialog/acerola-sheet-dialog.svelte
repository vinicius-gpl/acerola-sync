<script module lang="ts">
	import type { Snippet } from 'svelte';

	export type AcerolaSheetDialogProps = {
		state?: { open: boolean };
		data: {
			title: string;
			description?: string;
			/** Linha pequena acima do título. */
			eyebrow?: string;
			closeLabel?: string;
		};
		events?: {
			onOpenChange?: (open: boolean) => void;
		};
		ui?: {
			class?: string;
		};
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';
	import XIcon from '@lucide/svelte/icons/x';
	import { Dialog } from 'bits-ui';

	let {
		state = $bindable({ open: false }),
		data,
		events,
		ui,
		children
	}: AcerolaSheetDialogProps = $props();
</script>

<!--
	Diálogo de formulário no padrão do app: folha sem borda, título grande, fechar redondo.
	Rola por dentro quando o conteúdo passa da altura do popup.
-->
<Dialog.Root bind:open={state.open} onOpenChange={events?.onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-scrim/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			data-sheet-dialog
			class={cn(
				'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100%-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-sheet bg-card p-6 text-foreground shadow-float outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
				ui?.class
			)}
		>
			<header class="flex items-start gap-3">
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					{#if data.eyebrow}
						<span class="text-xs font-semibold text-muted-foreground">{data.eyebrow}</span>
					{/if}
					<Dialog.Title class="text-2xl leading-tight font-black tracking-tight">
						{data.title}
					</Dialog.Title>
					{#if data.description}
						<Dialog.Description class="text-sm text-muted-foreground">
							{data.description}
						</Dialog.Description>
					{/if}
				</div>
				<Dialog.Close
					class="grid size-10 flex-none cursor-pointer place-items-center rounded-full bg-surface transition-transform hover:scale-105"
					aria-label={data.closeLabel ?? 'Fechar'}
				>
					<XIcon size={16} />
				</Dialog.Close>
			</header>
			{#if children}{@render children()}{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
