<script module lang="ts">
	export type AcerolaTimePickerProps = {
		data: {
			/** `HH:MM`, 24h. */
			value: string;
			label?: string;
		};
		events?: {
			onChange?: (value: string) => void;
		};
		ui?: {
			class?: string;
			/** Passo dos minutos. */
			minuteStep?: number;
		};
	};

	export const pad = (value: number) => String(value).padStart(2, '0');

	/**
	 * Ao abrir, a hora e o minuto escolhidos ficam no meio da coluna (só a coluna rola). O
	 * cartão só ganha tamanho depois que o popover se posiciona: centraliza quando a coluna
	 * passa a ter altura, uma vez.
	 */
	export function centerSelected(node: HTMLElement) {
		let done = false;
		const center = () => {
			const selected = node.querySelector<HTMLElement>('[aria-selected="true"]');
			if (done || !selected || node.clientHeight === 0) return;
			done = true;
			// O espaço em cima e embaixo da coluna deixa até o primeiro e o último no meio.
			node.scrollTop = selected.offsetTop - node.clientHeight / 2 + selected.offsetHeight / 2;
		};
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(center);
		observer?.observe(node);
		const frame = requestAnimationFrame(center);
		return {
			destroy() {
				observer?.disconnect();
				cancelAnimationFrame(frame);
			}
		};
	}

	export function parseTime(value: string): { hour: number; minute: number } {
		const [hour, minute] = value.split(':').map(Number);
		return {
			hour: Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : 0,
			minute: Number.isInteger(minute) && minute >= 0 && minute < 60 ? minute : 0
		};
	}
</script>

<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils/cn.utils';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import { Popover } from 'bits-ui';

	let { data, events, ui }: AcerolaTimePickerProps = $props();

	let open = $state(false);

	const step = $derived(ui?.minuteStep ?? 5);
	const current = $derived(parseTime(data.value));
	const hours = Array.from({ length: 24 }, (_, hour) => hour);
	const minutes = $derived(
		Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step)
			.concat(
				// Valor salvo fora do passo (ex.: 09:07) continua aparecendo e selecionado.
				current.minute % step ? [current.minute] : []
			)
			.sort((a, b) => a - b)
	);

	function pick(patch: Partial<{ hour: number; minute: number }>) {
		const next = { ...current, ...patch };
		events?.onChange?.(`${pad(next.hour)}:${pad(next.minute)}`);
	}
</script>

{#snippet column(label: string, items: number[], selected: number, onPick: (value: number) => void)}
	<div class="flex min-w-0 flex-1 flex-col gap-1.5">
		<span
			class="px-1 text-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
		>
			{label}
		</span>
		<div
			role="listbox"
			aria-label={label}
			use:centerSelected
			class="relative flex h-56 [scrollbar-width:none] flex-col gap-1 overflow-y-auto rounded-tile bg-surface fade-y px-1 py-[94px]"
		>
			{#each items as item (item)}
				<button
					type="button"
					role="option"
					aria-selected={item === selected}
					onclick={() => onPick(item)}
					class={cn(
						'h-9 flex-none cursor-pointer rounded-full font-black text-base tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
						item === selected
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-mantle hover:text-foreground'
					)}
				>
					{pad(item)}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<!-- Seletor de horário no padrão do app: pílula com a hora grande; abre um cartão com as
     colunas de hora (24h) e minuto, sem o seletor nativo do navegador. -->
<Popover.Root bind:open>
	<Popover.Trigger
		aria-label={data.label}
		data-time-picker
		class={cn(
			'flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface pr-3 pl-4 text-foreground transition-colors hover:bg-mantle',
			open && 'bg-primary-soft text-primary',
			ui?.class
		)}
	>
		<span class="text-lg leading-none font-black tabular-nums">{data.value}</span>
		<ClockIcon size={15} class="opacity-70" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			sideOffset={8}
			align="start"
			onOpenAutoFocus={(event) => {
				// O foco automático ia para o "00" e rolava a coluna de volta ao topo. O foco vai
				// para a hora escolhida, sem rolar (a coluna já está centralizada nela).
				event.preventDefault();
				requestAnimationFrame(() =>
					(event.currentTarget as HTMLElement | null)
						?.querySelector<HTMLElement>('[role=option][aria-selected="true"]')
						?.focus({ preventScroll: true })
				);
			}}
			class="z-50 flex w-60 flex-col gap-3 rounded-card bg-card p-3 text-foreground shadow-float outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
		>
			<div class="flex gap-2">
				{@render column(m['sync.time_picker.hour'](), hours, current.hour, (hour) =>
					pick({ hour })
				)}
				<span class="self-center pt-5 text-xl font-black text-muted-foreground">:</span>
				{@render column(m['sync.time_picker.minute'](), minutes, current.minute, (minute) =>
					pick({ minute })
				)}
			</div>
			<Popover.Close
				class="h-10 cursor-pointer rounded-full bg-foreground text-sm font-black text-background transition-transform active:scale-[0.98]"
			>
				{m['sync.time_picker.done']()}
			</Popover.Close>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
