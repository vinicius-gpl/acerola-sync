<script module lang="ts">
	export type AcerolaSiteIconProps = {
		data: {
			name: string;
			/** URL ou match pattern do site; o favicon sai daqui. */
			url?: string | null;
		};
		ui?: {
			class?: string;
		};
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn.utils';
	import { faviconUrl } from '$lib/utils/favicon.utils';

	let { data, ui }: AcerolaSiteIconProps = $props();

	let failed = $state(false);
	const src = $derived(data.url ? faviconUrl(data.url) : null);
</script>

<!-- Ícone do site num quadrado de cartão. Sem favicon (ou se ele falhar), mostra a inicial. -->
<span
	class={cn(
		'flex size-11 flex-none items-center justify-center overflow-hidden rounded-inner bg-surface text-lg font-black',
		ui?.class
	)}
>
	{#if src && !failed}
		<img {src} alt="" class="size-6" onerror={() => (failed = true)} />
	{:else}
		{data.name.slice(0, 1).toUpperCase()}
	{/if}
</span>
