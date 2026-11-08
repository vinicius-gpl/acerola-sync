<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { makeEntry, makeMedia } from '../../../../tests/fixtures/media';
	import AcerolaMediaCard from './acerola-media-card.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaMediaCard',
		component: AcerolaMediaCard,
		tags: ['autodocs']
	});
</script>

<Story name="Em andamento" asChild>
	<div class="w-36">
		<AcerolaMediaCard
			data={{ media: makeMedia(), entry: makeEntry(), subtitle: 'Assistindo · TV' }}
			events={{ onIncrement: () => {} }}
		/>
	</div>
</Story>

<Story name="Lançando e atrasado" asChild>
	<div class="w-36">
		<AcerolaMediaCard
			data={{
				media: makeMedia({ status: 'RELEASING', nextAiringEpisode: 7 }),
				entry: makeEntry({ progress: 4 })
			}}
			events={{ onIncrement: () => {} }}
		/>
	</div>
</Story>

<Story name="Pendente" asChild>
	<div class="w-36">
		<AcerolaMediaCard
			data={{ media: makeMedia(), entry: makeEntry({ dirty: true }), badge: 'Ep 5 · 2d 4h' }}
		/>
	</div>
</Story>
