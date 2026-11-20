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
	import { brandUrl } from '$lib/constants/brand';
	import { cn } from '$lib/utils/cn.utils';

	let { data, ui }: AcerolaBrandImageProps = $props();
</script>

<!-- Logo or mascot from the copies shipped with the extension. -->
<img
	src={brandUrl(data.asset)}
	alt={data.alt ?? ''}
	data-brand={data.asset}
	class={cn('object-contain select-none', ui?.class)}
	draggable="false"
/>
