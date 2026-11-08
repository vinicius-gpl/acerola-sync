<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaSiteIcon from './acerola-site-icon.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaSiteIcon',
		component: AcerolaSiteIcon,
		tags: ['autodocs']
	});
</script>

<Story name="Sem favicon" asChild>
	<AcerolaSiteIcon data={{ name: 'Leitor' }} />
</Story>

<Story name="Com favicon" asChild>
	<AcerolaSiteIcon data={{ name: 'MangaDex', url: 'https://mangadex.org/*' }} />
</Story>
