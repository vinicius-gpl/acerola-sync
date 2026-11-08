<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AcerolaListFilters, { EMPTY_FILTERS } from './acerola-list-filters.svelte';

	const { Story } = defineMeta({
		title: 'Sync/AcerolaListFilters',
		component: AcerolaListFilters,
		tags: ['autodocs']
	});

	const facets = {
		genres: ['Action', 'Comedy', 'Drama', 'Fantasy', 'Slice of Life'],
		formats: ['TV', 'MOVIE', 'OVA'],
		years: [2026, 2025, 2024, 2023, 2016]
	};
</script>

<Story name="Fechado" asChild>
	<div class="w-[420px]">
		<AcerolaListFilters data={{ value: EMPTY_FILTERS, facets }} />
	</div>
</Story>

<Story name="Com filtros" asChild>
	<div class="w-[420px]">
		<AcerolaListFilters
			data={{
				value: { ...EMPTY_FILTERS, sort: 'score', genres: ['Drama'], year: 2024 },
				facets
			}}
		/>
	</div>
</Story>
