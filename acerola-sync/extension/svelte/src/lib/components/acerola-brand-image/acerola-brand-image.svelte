<script module lang="ts">
	import type { BrandAsset } from '$lib/constants/brand';

	export type AcerolaBrandImageProps = {
		data: {
			asset: BrandAsset;
			/** Empty when the image is decoration next to a text that already names it. */
			alt?: string;
		};
		ui?: {
			class?: string;
		};
	};
</script>

<script lang="ts">
	import { brandFallbackUrl, brandUrl } from '$lib/constants/brand';
	import { cn } from '$lib/utils/cn.utils';

	let { data, ui }: AcerolaBrandImageProps = $props();

	let failed = $state(false);
	const src = $derived(failed ? brandFallbackUrl(data.asset) : brandUrl(data.asset));
</script>

<!-- Logo or mascot from the brand CDN; falls back to the copy shipped with the extension. -->
<img
	{src}
	alt={data.alt ?? ''}
	data-brand={data.asset}
	class={cn('object-contain select-none', ui?.class)}
	draggable="false"
	onerror={() => (failed = true)}
/>
