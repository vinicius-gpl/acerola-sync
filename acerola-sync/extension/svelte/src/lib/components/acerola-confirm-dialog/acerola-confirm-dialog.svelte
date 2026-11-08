<script module lang="ts">
	import type { Component } from 'svelte';

	export type AcerolaConfirmDialogProps = {
		state?: { open: boolean };
		data: {
			title: string;
			description?: string;
			actionText: string;
			cancelText: string;
			/** Ícone no topo; o tom segue `ui.tone`. */
			icon?: Component;
		};
		events?: {
			onAction?: () => void;
			onCancel?: () => void;
		};
		ui?: {
			tone?: 'danger' | 'primary';
			busy?: boolean;
		};
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';
	import { pop } from '$lib/utils/motion.utils';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import { AlertDialog } from 'bits-ui';

	let {
		state = $bindable({ open: false }),
		data,
		events,
		ui
	}: AcerolaConfirmDialogProps = $props();
	const danger = $derived((ui?.tone ?? 'danger') === 'danger');
	const Icon = $derived(data.icon);
</script>

<!--
	Confirmação no padrão do app: folha sem borda, cantos de folha, ícone no tom do estado e
	botões em pílula, um em cima do outro (cabe no popup estreito).
-->
<AlertDialog.Root bind:open={state.open}>
	<AlertDialog.Portal>
		<AlertDialog.Overlay
			class="fixed inset-0 z-50 bg-scrim/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0"
		/>
		<AlertDialog.Content
			data-confirm-dialog
			class="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-sheet bg-card p-6 text-center text-foreground shadow-float outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
		>
			{#if Icon}
				<span
					use:pop
					class={cn(
						'mb-2 grid size-14 place-items-center rounded-full',
						danger ? 'bg-destructive-soft text-destructive' : 'bg-primary-soft text-primary'
					)}
				>
					<Icon size={26} />
				</span>
			{/if}
			<AlertDialog.Title class="text-2xl leading-tight font-black tracking-tight">
				{data.title}
			</AlertDialog.Title>
			{#if data.description}
				<AlertDialog.Description class="text-sm text-muted-foreground">
					{data.description}
				</AlertDialog.Description>
			{/if}
			<div class="mt-4 flex w-full flex-col gap-2">
				<AlertDialog.Action
					disabled={ui?.busy}
					onclick={events?.onAction}
					class={cn(
						'flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full font-black transition-[filter] hover:brightness-110 disabled:opacity-60',
						danger
							? 'bg-destructive text-destructive-foreground'
							: 'bg-primary text-primary-foreground'
					)}
				>
					{#if ui?.busy}<LoaderIcon size={16} class="animate-spin" />{/if}
					{data.actionText}
				</AlertDialog.Action>
				<AlertDialog.Cancel
					onclick={events?.onCancel}
					class="h-12 w-full cursor-pointer rounded-full bg-surface font-bold text-foreground transition-colors hover:bg-mantle"
				>
					{data.cancelText}
				</AlertDialog.Cancel>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
