<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaBrandImage from './acerola-brand-image.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaBrandImage',
		component: AcerolaBrandImage,
		tags: ['autodocs']
	});
</script>

<Story name="Logo" asChild>
	<AcerolaBrandImage data={{ asset: 'logo', alt: 'Acerola' }} ui={{ class: 'size-16' }} />
</Story>

<Story name="Mascote" asChild>
	<AcerolaBrandImage data={{ asset: 'mascot', alt: 'Mascote' }} ui={{ class: 'size-32' }} />
</Story>
