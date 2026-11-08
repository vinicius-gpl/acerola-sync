<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { makeEntryWithMedia } from '../../../../tests/fixtures/media';
	import AcerolaSpotlight from './acerola-spotlight.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaSpotlight',
		component: AcerolaSpotlight,
		tags: ['autodocs']
	});
</script>

<Story name="Default" asChild>
	<div class="w-[420px]">
		<AcerolaSpotlight
			data={{ entry: makeEntryWithMedia(), eyebrow: 'Continuar', caption: 'Ep 3 de 12' }}
			events={{ onIncrement: () => {} }}
		/>
	</div>
</Story>
