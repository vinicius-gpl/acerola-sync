<script module lang="ts">
	import { Input, type InputProps } from '$lib/components/ui/input';

	export type AcerolaInputProps = {
		state?: {
			value?: string;
		};
		events?: {
			onValueChange?: (value: string) => void;
			onInput?: (event: Event) => void;
		};
		ui?: {
			class?: string;
			placeholder?: string;
			disabled?: boolean;
			type?: Exclude<NonNullable<InputProps['type']>, 'file'>;
			id?: string;
			name?: string;
			autocomplete?: InputProps['autocomplete'];
		};
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';

	let { state: control, events, ui }: AcerolaInputProps = $props();

	let inputValue = $state('');
	let lastStateValue = $state('');

	const uiProps = $derived.by(() => {
		const { class: _class, ...rest } = ui ?? {};
		return rest;
	});

	$effect(() => {
		if (control?.value === undefined) return;

		const nextValue = control.value;

		if (nextValue !== lastStateValue) {
			inputValue = nextValue;
			lastStateValue = nextValue;
		}
	});

	function handleInput(event: Event) {
		const nextValue = (event.currentTarget as HTMLInputElement).value;

		inputValue = nextValue;
		lastStateValue = nextValue;
		events?.onValueChange?.(nextValue);
		events?.onInput?.(event);
	}
</script>

<Input
	bind:value={inputValue}
	class={cn('w-auto min-w-48 text-foreground disabled:pointer-events-auto', ui?.class)}
	oninput={handleInput}
	{...uiProps}
/>
